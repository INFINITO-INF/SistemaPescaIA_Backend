-- =========================================================================
-- PROYECTO: Sistema Inteligente de Ayuda para Tienda de Pesca (Monolito Modular)
-- MOTOR: Microsoft SQL Server (T-SQL)
-- PROPÓSITO: Base de datos con Cupones Modulares, Búsqueda por Etiquetas e Imágenes por Grupo
-- =========================================================================

USE master;
GO

IF EXISTS (SELECT name FROM sys.databases WHERE name = N'TiendaPescaIA_DB')
BEGIN
    ALTER DATABASE TiendaPescaIA_DB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE TiendaPescaIA_DB;
END
GO

CREATE DATABASE TiendaPescaIA_DB;
GO

USE TiendaPescaIA_DB;
GO

-- =========================================================================
-- MÓDULO 1: catalogo_inventario (EPIC03: US009, US010, US011, US012)
-- =========================================================================

-- 1. Tabla de Categorías y Subcategorías Jerárquicas (US002: CA005-CA007)
CREATE TABLE Categorias (
    id_categoria INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(255) NULL,
    id_categoria_padre INT NULL,
    activo BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_Categorias_Padre FOREIGN KEY (id_categoria_padre) REFERENCES Categorias(id_categoria)
);

-- 2. NUEVA TABLA: Cupones Modulares de Descuento (Soporta US012 y Promociones)
CREATE TABLE Cupones_Descuento (
    id_cupon INT IDENTITY(1,1) PRIMARY KEY,
    codigo_cupon VARCHAR(30) NOT NULL UNIQUE,      -- Ej: 'DESC-100', 'PROMO-2X1', 'SHI-15'
    nombre_cupon NVARCHAR(100) NOT NULL,
    descripcion_accion NVARCHAR(255) NOT NULL,     -- Lo que hace el cupón
    tipo_descuento VARCHAR(25) NOT NULL            -- 'MONTO_FIJO', 'PORCENTAJE', 'PROMO_2X1'
        CHECK (tipo_descuento IN ('MONTO_FIJO', 'PORCENTAJE', 'PROMO_2X1')),
    valor_descuento DECIMAL(10,2) NOT NULL CHECK (valor_descuento >= 0),
    activo BIT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME NOT NULL DEFAULT GETDATE()
);

-- 3. Tabla Principal de Productos (Cada unidad/modelo tiene su propio SKU único)
CREATE TABLE Productos (
    id_producto INT IDENTITY(1,1) PRIMARY KEY,
    sku VARCHAR(30) NOT NULL UNIQUE,
    nombre NVARCHAR(150) NOT NULL,
    marca NVARCHAR(80) NOT NULL,
    id_categoria INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
    precio_promocion DECIMAL(10,2) NULL CHECK (precio_promocion >= 0),
    id_cupon_aplicado INT NULL,                    -- Vinculación modular con Cupones_Descuento
    stock_actual INT NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    descripcion_tecnica NVARCHAR(MAX) NULL,
    resistencia_min_lb DECIMAL(6,2) NULL,
    resistencia_max_lb DECIMAL(6,2) NULL,
    peso_gr DECIMAL(6,2) NULL,
    potencia VARCHAR(40) NULL,
    accion VARCHAR(40) NULL,
    entorno_recomendado VARCHAR(50) NULL,
    clase_ia_vision VARCHAR(80) NULL,
    fecha_actualizacion DATETIME NOT NULL DEFAULT GETDATE(),
    activo BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_Productos_Categorias FOREIGN KEY (id_categoria) REFERENCES Categorias(id_categoria),
    CONSTRAINT FK_Productos_Cupones FOREIGN KEY (id_cupon_aplicado) REFERENCES Cupones_Descuento(id_cupon)
);

-- 4. NUEVA TABLA: Imágenes por Grupo de Productos Similares (Marca + Categoría)
CREATE TABLE Imagenes_Grupo_Catalogo (
    id_imagen_grupo INT IDENTITY(1,1) PRIMARY KEY,
    marca NVARCHAR(80) NOT NULL,
    id_categoria INT NOT NULL,
    url_imagen NVARCHAR(300) NOT NULL,
    resolucion VARCHAR(30) NOT NULL DEFAULT '1920x1080',
    CONSTRAINT UQ_Imagen_Marca_Categoria UNIQUE (marca, id_categoria),
    CONSTRAINT FK_ImgGrupo_Categoria FOREIGN KEY (id_categoria) REFERENCES Categorias(id_categoria) ON DELETE CASCADE
);

-- 5. Tabla de Imágenes Individuales (Opcional / Sobrescritura específica por producto)
CREATE TABLE Imagenes_Producto (
    id_imagen INT IDENTITY(1,1) PRIMARY KEY,
    id_producto INT NOT NULL,
    url_imagen NVARCHAR(300) NOT NULL,
    es_principal BIT NOT NULL DEFAULT 0,
    resolucion VARCHAR(30) NULL DEFAULT '1920x1080',
    CONSTRAINT FK_Imagenes_Producto FOREIGN KEY (id_producto) REFERENCES Productos(id_producto) ON DELETE CASCADE
);

-- 6. Tabla de Etiquetas Técnicas para IA y Búsqueda Rápida (US001 y US009)
CREATE TABLE Etiquetas_Tecnicas (
    id_etiqueta INT IDENTITY(1,1) PRIMARY KEY,
    nombre_etiqueta NVARCHAR(80) NOT NULL UNIQUE,
    tipo_etiqueta VARCHAR(50) NOT NULL
);

-- 7. Tabla Puente Producto - Etiquetas (Relación N:M)
CREATE TABLE Producto_Etiquetas (
    id_producto INT NOT NULL,
    id_etiqueta INT NOT NULL,
    PRIMARY KEY (id_producto, id_etiqueta),
    CONSTRAINT FK_ProdEtiq_Producto FOREIGN KEY (id_producto) REFERENCES Productos(id_producto) ON DELETE CASCADE,
    CONSTRAINT FK_ProdEtiq_Etiqueta FOREIGN KEY (id_etiqueta) REFERENCES Etiquetas_Tecnicas(id_etiqueta) ON DELETE CASCADE
);

-- =========================================================================
-- MÓDULOS 3, 4 Y 5 (Asesor IA, Carrito/Tickets y Administración)
-- =========================================================================

CREATE TABLE Escenarios_Pesca (
    id_escenario INT IDENTITY(1,1) PRIMARY KEY,
    especie_objetivo NVARCHAR(80) NOT NULL,
    entorno VARCHAR(50) NOT NULL,
    potencia_recomendada VARCHAR(40) NOT NULL,
    resistencia_sugerida_min_lb DECIMAL(6,2) NOT NULL,
    resistencia_sugerida_max_lb DECIMAL(6,2) NOT NULL,
    explicacion_base_ia NVARCHAR(500) NOT NULL
);

CREATE TABLE Sesiones_Carrito (
    id_sesion UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    estado_sesion VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    fecha_inicio DATETIME NOT NULL DEFAULT GETDATE(),
    ultima_interaccion DATETIME NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Detalle_Carrito_Temporal (
    id_detalle_carrito INT IDENTITY(1,1) PRIMARY KEY,
    id_sesion UNIQUEIDENTIFIER NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_capturado DECIMAL(10,2) NOT NULL,
    origen_seleccion VARCHAR(30) NOT NULL DEFAULT 'BUSQUEDA',
    CONSTRAINT FK_DetalleCarrito_Sesion FOREIGN KEY (id_sesion) REFERENCES Sesiones_Carrito(id_sesion) ON DELETE CASCADE,
    CONSTRAINT FK_DetalleCarrito_Producto FOREIGN KEY (id_producto) REFERENCES Productos(id_producto)
);

CREATE TABLE Tickets_Pedido (
    id_ticket INT IDENTITY(1,1) PRIMARY KEY,
    codigo_ticket VARCHAR(25) NOT NULL UNIQUE,
    id_sesion UNIQUEIDENTIFIER NOT NULL,
    monto_total DECIMAL(10,2) NOT NULL,
    payload_qr NVARCHAR(MAX) NOT NULL,
    estado_ticket VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE_CAJA',
    fecha_emision DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Tickets_Sesion FOREIGN KEY (id_sesion) REFERENCES Sesiones_Carrito(id_sesion)
);

CREATE TABLE Configuracion_Kiosco (
    id_config INT PRIMARY KEY CHECK (id_config = 1),
    tiempo_inactividad_seg INT NOT NULL DEFAULT 60,
    tiempo_alerta_regresiva_seg INT NOT NULL DEFAULT 10,
    modo_mantenimiento BIT NOT NULL DEFAULT 0,
    pin_administrador_hash VARCHAR(128) NOT NULL,
    mensaje_mantenimiento NVARCHAR(255) NOT NULL DEFAULT N'Sistema en actualización, consulte en mostrador'
);

CREATE TABLE Logs_Actividad_IA_Busqueda (
    id_log INT IDENTITY(1,1) PRIMARY KEY,
    tipo_evento VARCHAR(30) NOT NULL,
    termino_o_clase_buscada NVARCHAR(150) NOT NULL,
    id_producto_detectado INT NULL,
    confianza_ia DECIMAL(5,2) NULL,
    tuvo_resultados BIT NOT NULL DEFAULT 1,
    tenia_stock BIT NOT NULL DEFAULT 1,
    convertido_en_ticket BIT NOT NULL DEFAULT 0,
    id_ticket_asociado INT NULL,
    fecha_evento DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Logs_Producto FOREIGN KEY (id_producto_detectado) REFERENCES Productos(id_producto),
    CONSTRAINT FK_Logs_Ticket FOREIGN KEY (id_ticket_asociado) REFERENCES Tickets_Pedido(id_ticket)
);
GO

-- =========================================================================
-- INSERCIÓN DE DATOS SEMILLA
-- =========================================================================

-- 1. Categorías Principales y Subcategorías
INSERT INTO Categorias (nombre, descripcion, id_categoria_padre) VALUES
(N'Cañas de Pesca', N'Cañas para diferentes modalidades de pesca', NULL),          -- ID 1
(N'Carretes', N'Carretes spinning, casting y curricán', NULL),                  -- ID 2
(N'Señuelos', N'Señuelos artificiales para río y mar', NULL),                   -- ID 3
(N'Líneas y Sedales', N'Líneas trenzadas, monofilamento y fluorocarbono', NULL),-- ID 4
(N'Accesorios y Anzuelos', N'Anzuelos, plomos, destorcedores y herramientas', NULL), -- ID 5
(N'Señuelos Agua Dulce', N'Cucharillas, spinners y crankbaits para río/laguna', 3), -- ID 6
(N'Señuelos de Mar', N'Jigs metálicos, poppers y minnows de agua salada', 3);       -- ID 7

-- 2. Cupones Modulares Iniciales
INSERT INTO Cupones_Descuento (codigo_cupon, nombre_cupon, descripcion_accion, tipo_descuento, valor_descuento) VALUES
('SHI-PROMO15', N'Bono Shimano S/ 15.10', N'Descuento directo de S/ 15.10 en equipos seleccionados', 'MONTO_FIJO', 15.10),   -- ID 1
('DAIWA-16', N'Rebaja Daiwa S/ 16.00', N'Descuento de S/ 16.00 en carretes seleccionados', 'MONTO_FIJO', 16.00),             -- ID 2
('MAR-7SOLES', N'Promo Señuelo Mar S/ 7.00', N'Descuento de S/ 7.00 en señuelos de playa', 'MONTO_FIJO', 7.00),              -- ID 3
('CUPON-100', N'Súper Bono S/ 100.00', N'Descuento fijo de S/ 100 (Solo aplicable a productos que cuesten más de S/ 100)', 'MONTO_FIJO', 100.00), -- ID 4
('PROMO-2X1', N'Liquidación 2x1 (Seg. Unidad S/ 0)', N'Deja el producto bonificado en S/ 0.00 por promoción 2x1', 'PROMO_2X1', 100.00);          -- ID 5

-- 3. Productos (11 productos con SKUs únicos organizados por Marca y Categoría)
INSERT INTO Productos (
    sku, nombre, marca, id_categoria, precio_unitario, precio_promocion, id_cupon_aplicado, stock_actual,
    descripcion_tecnica, resistencia_min_lb, resistencia_max_lb, peso_gr,
    potencia, accion, entorno_recomendado, clase_ia_vision
) VALUES
-- ID 1: Caña Shimano 1 (S/ 145.00 -> Con Cupón 1 queda en 129.90)
('CAN-SHI-001', N'Caña Shimano FX Spinning 2.10m', N'Shimano', 1, 145.00, 129.90, 1, 8,
 N'Caña de fibra de vidrio reforzada ideal para pesca variada en orilla y río. Excelente sensibilidad y resistencia.',
 10.00, 20.00, 185.00, 'Media', 'Rápida', 'Ambos', 'cana_spinning_media'),

-- ID 2: Caña Okuma
('CAN-OKU-002', N'Caña Okuma Celilo Ultralight 1.80m', N'Okuma', 1, 110.00, NULL, NULL, 5,
 N'Caña ultraligera diseñada específicamente para pesca de trucha en ríos y lagunas de alta montaña.',
 2.00, 6.00, 95.00, 'Ultraligera', 'Moderada', 'Agua dulce', 'cana_ultraligera'),

-- ID 3: Carrete Shimano
('CAR-SHI-003', N'Carrete Shimano Sienna 4000 FG', N'Shimano', 2, 165.00, NULL, NULL, 12,
 N'Carrete frontal con freno delantero suave de 8.5 kg, bobina de aluminio propulso y 4 rodamientos.',
 10.00, 20.00, 320.00, 'Media', 'Rápida', 'Ambos', 'carrete_spinning_4000'),

-- ID 4: Carrete Daiwa (S/ 175.00 -> Con Cupón 2 queda en 159.00)
('CAR-DAI-004', N'Carrete Daiwa Laguna LT 4000', N'Daiwa', 2, 175.00, 159.00, 2, 6,
 N'Carrete ligero con tecnología LT, freno ATD de alta precisión ideal para agua dulce y salada ligera.',
 10.00, 22.00, 290.00, 'Media', 'Rápida', 'Ambos', 'carrete_spinning_4000'),

-- ID 5: Línea PowerPro (Cuesta S/ 95.00 -> Menor o igual a 100, estará en gris para CUPON-100)
('LIN-POW-005', N'Línea Trenzada PowerPro Spectra 15 lb 150m', N'PowerPro', 4, 95.00, NULL, NULL, 15,
 N'Multifilamento de 4 hebras ultra resistente a la abrasión, sin memoria mecánica.',
 15.00, 15.00, 45.00, 'Media', 'Rápida', 'Ambos', 'linea_trenzada_verde'),

-- ID 6: Línea Sufix
('LIN-SUF-006', N'Línea Trenzada Sufix 832 50 lb 300m', N'Sufix', 4, 150.00, NULL, NULL, 4,
 N'Línea de alta resistencia para pesca pesada de grandes depredadores en mar.',
 50.00, 50.00, 80.00, 'Pesada', 'Rápida', 'Mar - Embarcación', 'linea_trenzada_pesada'),

-- ID 7: Señuelo Rapala (Agua Dulce)
('SEN-RAP-007', N'Señuelo Rapala Countdown CD07 Trucha', N'Rapala', 6, 48.00, NULL, NULL, 10,
 N'Señuelo de madera balsa con hundimiento controlado para explorar distintas capas de agua en ríos.',
 4.00, 12.00, 8.00, 'Ultraligera', 'Moderada', 'Agua dulce', 'senuelo_minnow_trucha'),

-- ID 8: Señuelo Yo-Zuri AGOTADO
('SEN-YOM-008', N'Señuelo Yo-Zuri Crystal Minnow 130mm Corvina', N'Yo-Zuri', 7, 65.00, NULL, NULL, 0,
 N'Señuelo flotante con acabado holográfico prisma 3D para pesca de corvina y lenguado desde orilla.',
 12.00, 25.00, 21.00, 'Media', 'Rápida', 'Mar - Orilla', 'senuelo_minnow_mar'),

-- ID 9: Señuelo Shimano (Con Cupón 3 queda en 55.00)
('SEN-SHI-009', N'Señuelo Shimano Borona Minnow 125mm', N'Shimano', 7, 62.00, 55.00, 3, 7,
 N'Señuelo de lance largo con sistema de transferencia de pesos para playas ventosas (Surfcasting).',
 10.00, 22.00, 19.50, 'Media', 'Rápida', 'Mar - Orilla', 'senuelo_minnow_mar'),

-- ID 10: Anzuelos Mustad (SIN imagen individual ni grupal -> Prueba CA028 imagen por defecto)
('ACC-MUST-010', N'Pack Anzuelos Mustad Baitholder #2', N'Mustad', 5, 18.00, NULL, NULL, 25,
 NULL, NULL, NULL, 5.00, NULL, NULL, 'Ambos', 'anzuelo_simple'),

-- ID 11: Segunda Caña Shimano con SKU distinto (Comparte imagen grupal de Shimano + Cañas y cuesta S/ 100.00 exactos para probar borde de cupón)
('CAN-SHI-011', N'Caña Shimano Sojourn Surf 2.40m', N'Shimano', 1, 100.00, NULL, NULL, 9,
 N'Caña de grafito compuesto para lance de orilla y escollera. Comparte familia visual con Cañas Shimano.',
 12.00, 25.00, 210.00, 'Media', 'Rápida', 'Mar - Orilla', 'cana_spinning_media');

-- 4. Imágenes por Grupo (Marca + Categoría) -> Omitimos Mustad (ID 10) deliberadamente para cumplir CA028
INSERT INTO Imagenes_Grupo_Catalogo (marca, id_categoria, url_imagen, resolucion) VALUES
(N'Shimano', 1, '/static/img/grupos/shimano_canas.jpg', '1920x1080'),
(N'Okuma',   1, '/static/img/grupos/okuma_canas.jpg', '1920x1080'),
(N'Shimano', 2, '/static/img/grupos/shimano_carretes.jpg', '1920x1080'),
(N'Daiwa',   2, '/static/img/grupos/daiwa_carretes.jpg', '1920x1080'),
(N'PowerPro',4, '/static/img/grupos/powerpro_lineas.jpg', '1920x1080'),
(N'Sufix',   4, '/static/img/grupos/sufix_lineas.jpg', '1920x1080'),
(N'Rapala',  6, '/static/img/grupos/rapala_senuelos.jpg', '1920x1080'),
(N'Yo-Zuri', 7, '/static/img/grupos/yozuri_senuelos.jpg', '1920x1080'),
(N'Shimano', 7, '/static/img/grupos/shimano_senuelos.jpg', '1920x1080');

-- También insertamos una imagen secundaria en Producto 1 para que tenga galería de 2 fotos en CA027
INSERT INTO Imagenes_Producto (id_producto, url_imagen, es_principal) VALUES
(1, '/static/img/grupos/shimano_canas_detalle.jpg', 0);

-- 5. Etiquetas Técnicas
INSERT INTO Etiquetas_Tecnicas (nombre_etiqueta, tipo_etiqueta) VALUES
(N'Trucha', 'Especie'),            -- ID 1
(N'Corvina', 'Especie'),           -- ID 2
(N'Lenguado', 'Especie'),          -- ID 3
(N'Spinning', 'Modalidad'),        -- ID 4
(N'Surfcasting', 'Modalidad'),     -- ID 5
(N'Agua Dulce / Río', 'Entorno'),  -- ID 6
(N'Mar / Orilla', 'Entorno');      -- ID 7

INSERT INTO Producto_Etiquetas (id_producto, id_etiqueta) VALUES
(1, 2), (1, 4), (1, 7),
(2, 1), (2, 4), (2, 6),
(3, 2), (3, 4), (3, 7),
(4, 2), (4, 4), (4, 7),
(5, 2), (5, 4), (5, 7),
(7, 1), (7, 4), (7, 6),
(8, 2), (8, 3), (8, 5), (8, 7),
(9, 2), (9, 3), (9, 5), (9, 7),
(11, 2), (11, 5), (11, 7);

-- 6. Escenarios, Configuración y Logs
INSERT INTO Escenarios_Pesca (especie_objetivo, entorno, potencia_recomendada, resistencia_sugerida_min_lb, resistencia_sugerida_max_lb, explicacion_base_ia) VALUES
(N'Trucha', 'Agua dulce', 'Ultraligera', 2.00, 8.00, N'Para trucha en río se requiere equipo ultraligero (2-6 lb) que permita lanzar señuelos pequeños con precisión.'),
(N'Corvina', 'Mar - Orilla', 'Media', 10.00, 22.00, N'Para corvina desde playa se recomienda un equipo de potencia media (10-20 lb) con señuelos minnow de buen lance.');

INSERT INTO Configuracion_Kiosco (id_config, tiempo_inactividad_seg, tiempo_alerta_regresiva_seg, modo_mantenimiento, pin_administrador_hash)
VALUES (1, 60, 10, 0, '1234');

INSERT INTO Logs_Actividad_IA_Busqueda (tipo_evento, termino_o_clase_buscada, id_producto_detectado, confianza_ia, tuvo_resultados, tenia_stock, convertido_en_ticket) VALUES
('TEXTO', N'Shimano', 1, NULL, 1, 1, 1),
('IMAGEN_IA', N'senuelo_minnow_mar', 8, 91.40, 1, 0, 0),
('IMAGEN_IA', N'carrete_spinning_4000', 3, 86.20, 1, 1, 1),
('TEXTO', N'Arpón submarino', NULL, NULL, 0, 0, 0);
GO