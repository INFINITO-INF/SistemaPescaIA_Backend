import pytest

# =========================================================================
# PRUEBAS DE ACEPTACIÓN - HISTORIA US001 (CA001, CA002, CA003, CA004)
# =========================================================================

@pytest.mark.acceptance
def test_ca001_busqueda_por_texto_directo(client):
    """
    CA001 - Búsqueda por texto directo:
    Dado que el cliente está en la pantalla principal, cuando ingresa un término válido
    ('Shimano'), el sistema muestra la lista de productos coincidentes.
    """
    response = client.get("/api/v1/busqueda/texto?q=Shimano")
    data = response.get_json()

    assert response.status_code == 200
    assert data["tuvo_resultados"] is True
    assert len(data["resultados"]) >= 1
    assert all("Shimano" in p["nombre"] or "Shimano" in p["marca"] for p in data["resultados"])

@pytest.mark.acceptance
def test_ca002_autocompletado_tras_3_caracteres(client):
    """
    CA002 - Autocompletado tras 3 caracteres:
    Cuando el cliente digita menos de 3 caracteres no hay sugerencias; al digitar 3 o más ('Car'),
    el sistema despliega sugerencias automáticas del catálogo.
    """
    res_corto = client.get("/api/v1/busqueda/autocompletar?q=Ca").get_json()
    res_valido = client.get("/api/v1/busqueda/autocompletar?q=Car").get_json()

    assert res_corto["Autocompletado_activo"] is False
    assert res_corto["sugerencias"] == []
    assert res_valido["Autocompletado_activo"] is True
    assert len(res_valido["sugerencias"]) >= 1

@pytest.mark.acceptance
def test_ca003_busqueda_sin_coincidencias(client):
    """
    CA003 - Búsqueda sin coincidencias:
    Cuando el cliente busca un término inexistente, el sistema muestra 'No se encontraron productos'
    y sugiere las categorías generales.
    """
    response = client.get("/api/v1/busqueda/texto?q=SubmarinoNuclear999")
    data = response.get_json()

    assert response.status_code == 200
    assert data["tuvo_resultados"] is False
    assert data["mensaje"] == "No se encontraron productos"
    assert len(data["categorias_sugeridas"]) >= 5

@pytest.mark.acceptance
def test_ca004_limpieza_del_campo_de_busqueda(client):
    """
    CA004 - Limpieza del campo de búsqueda:
    Cuando el cliente presiona limpiar búsqueda, el sistema borra el texto y restablece la vista.
    """
    response = client.post("/api/v1/busqueda/limpiar")
    data = response.get_json()

    assert response.status_code == 200
    assert data["termino_buscado"] == ""
    assert data["resultados"] == []
    assert data["vista_restablecida"] is True

# =========================================================================
# PRUEBAS DE ACEPTACIÓN - HISTORIA US002 (CA005, CA006, CA007)
# =========================================================================

@pytest.mark.acceptance
def test_ca005_seleccion_de_categoria_principal(client):
    """
    CA005 - Selección de categoría principal:
    Cuando el cliente selecciona la categoría 'Carretes' (ID=2), el sistema muestra únicamente
    los productos pertenecientes a dicha categoría.
    """
    response = client.get("/api/v1/busqueda/categorias/2/productos")
    data = response.get_json()

    assert response.status_code == 200
    assert len(data["productos"]) >= 2
    assert all(p["id_categoria"] == 2 for p in data["productos"])

@pytest.mark.acceptance
def test_ca006_filtro_por_subcategoria(client):
    """
    CA006 - Filtro por subcategoría:
    Dentro de la categoría 'Señuelos' (ID=3), cuando elige la subcategoría 'Señuelos Agua Dulce' (ID=6),
    el sistema refina la lista mostrando solo señuelos para agua dulce.
    """
    res_padre = client.get("/api/v1/busqueda/categorias/3/productos").get_json()
    res_sub = client.get("/api/v1/busqueda/categorias/6/productos").get_json()

    assert len(res_padre["subcategorias_disponibles"]) == 2
    assert len(res_sub["productos"]) == 1
    assert res_sub["productos"][0]["sku"] == "SEN-RAP-007"

@pytest.mark.acceptance
def test_ca007_retorno_a_menu_principal_de_categorias(client):
    """
    CA007 - Retorno a menú principal de categorías:
    Cuando el cliente presiona 'Volver a categorías', el sistema restablece la vista principal.
    """
    response = client.post("/api/v1/busqueda/categorias/volver")
    data = response.get_json()

    assert response.status_code == 200
    assert data["vista"] == "MENU_PRINCIPAL_CATEGORIAS"
    assert data["id_categoria_seleccionada"] is None
    assert len(data["categorias_principales"]) == 5

# =========================================================================
# PRUEBAS DE ACEPTACIÓN - HISTORIA US009 (CA021, CA022, CA023)
# =========================================================================

@pytest.mark.acceptance
def test_ca021_asignacion_manual_e_indexacion_de_etiquetas(client):
    """
    CA021 - Asignación manual e indexación de etiquetas:
    Cuando el administrador asigna una etiqueta técnica a un producto (ej. Producto 10, Etiqueta 4 'Spinning'),
    el sistema la persiste e indexa en la base de datos.
    """
    response = client.post("/api/v1/catalogo/productos/10/etiquetas", json={"id_etiqueta": 4})
    data = response.get_json()

    assert response.status_code == 200
    assert data["indexado"] is True
    ids_indexados = [e["id_etiqueta"] for e in data["etiquetas_indexadas"]]
    assert 4 in ids_indexados

@pytest.mark.acceptance
def test_ca022_sugerencia_automatica_de_etiquetas_al_registrar(client):
    """
    CA022 - Sugerencia automática de etiquetas al registrar:
    Cuando el administrador ingresa la descripción técnica de un producto nuevo,
    el sistema sugiere automáticamente las etiquetas normalizadas relevantes.
    """
    payload = {
        "descripcion_tecnica": "Señuelo especial para pesca de corvina y lenguado desde playa en modalidad surfcasting"
    }
    response = client.post("/api/v1/catalogo/etiquetas/sugerir", json=payload)
    data = response.get_json()
    etiquetas_sugeridas = [e["nombre_etiqueta"] for e in data["sugerencias"]]

    assert response.status_code == 200
    assert "Corvina" in etiquetas_sugeridas
    assert "Lenguado" in etiquetas_sugeridas
    assert "Surfcasting" in etiquetas_sugeridas

@pytest.mark.acceptance
def test_ca023_actualizacion_de_referencias_en_motor_ia(client):
    """
    CA023 - Actualización de referencias en el motor de IA:
    Cuando el administrador modifica las etiquetas de un producto existente,
    el sistema actualiza el índice inmediatamente sin reiniciar la aplicación.
    """
    response = client.put("/api/v1/catalogo/productos/10/etiquetas", json={"ids_etiquetas": [1, 6]})
    data = response.get_json()

    assert response.status_code == 200
    assert data["actualizado"] is True
    assert data["indice_ia_sincronizado"] is True
    assert [e["id_etiqueta"] for e in data["etiquetas_vigentes"]] == [1, 6]

# =========================================================================
# PRUEBAS DE ACEPTACIÓN - HISTORIA US010 (CA024, CA025, CA026)
# =========================================================================

@pytest.mark.acceptance
def test_ca024_muestra_de_producto_con_stock_disponible(client):
    """
    CA024 - Muestra de producto con stock disponible:
    Cuando el artículo tiene stock > 0 (Producto 1), muestra indicador verde 'Disponible en tienda'
    y la cantidad exacta.
    """
    response = client.get("/api/v1/catalogo/productos/1/stock")
    data = response.get_json()

    assert response.status_code == 200
    assert data["leyenda"] == "Disponible en tienda"
    assert data["indicador_color"] == "verde"
    assert data["stock_actual"] > 0
    assert data["boton_agregar_habilitado"] is True

@pytest.mark.acceptance
def test_ca025_muestra_de_producto_agotado_y_bloqueo(client):
    """
    CA025 - Muestra de producto agotado y bloqueo:
    Cuando el artículo tiene stock = 0 (Producto 8), muestra etiqueta roja 'Agotado'
    y deshabilita el botón de agregar a la lista temporal.
    """
    response = client.get("/api/v1/catalogo/productos/8/stock")
    data = response.get_json()

    assert response.status_code == 200
    assert data["leyenda"] == "Agotado"
    assert data["indicador_color"] == "rojo"
    assert data["stock_actual"] == 0
    assert data["boton_agregar_habilitado"] is False

@pytest.mark.acceptance
def test_ca026_reflejo_de_cambios_de_inventario_en_tiempo_real(client, catalogo_service):
    """
    CA026 - Reflejo de cambios de inventario en tiempo real:
    Cuando el stock cambia en la BD central por una venta o ingreso, la siguiente consulta
    refleja el nuevo valor sin requerir reinicio.
    """
    stock_inicial = client.get("/api/v1/catalogo/productos/3/stock").get_json()["stock_actual"]
    try:
        # Simulamos descuento de 1 unidad en caja registradora
        catalogo_service.repo.actualizar_stock_producto(3, stock_inicial - 1)
        nuevo_estado = client.get("/api/v1/catalogo/productos/3/stock").get_json()
        assert nuevo_estado["stock_actual"] == stock_inicial - 1
    finally:
        # Restauramos el stock original para mantener idempotencia en las pruebas
        catalogo_service.repo.actualizar_stock_producto(3, stock_inicial)

# =========================================================================
# PRUEBAS DE ACEPTACIÓN - HISTORIA US011 (CA027, CA028)
# =========================================================================

@pytest.mark.acceptance
def test_ca027_renderizado_completo_de_ficha_tecnica_e_imagenes(client):
    """
    CA027 - Renderizado completo de ficha técnica e imágenes:
    Al abrir el detalle del Producto 1, muestra nombre, marca, SKU, especificaciones,
    precio y galería de imágenes en alta resolución.
    """
    response = client.get("/api/v1/catalogo/productos/1/ficha")
    data = response.get_json()

    assert response.status_code == 200
    assert data["sku"] == "CAN-SHI-001"
    assert data["marca"] == "Shimano"
    assert data["especificaciones"]["potencia"] == "Media"
    assert len(data["galeria_imagenes"]) >= 2
    assert data["galeria_imagenes"][0]["es_default"] is False

@pytest.mark.acceptance
def test_ca028_manejo_de_producto_sin_imagen_secundaria(client):
    """
    CA028 - Manejo de producto sin imagen registrada:
    Al abrir la ficha del Producto 10 (que no tiene fotos en BD), muestra la imagen genérica
    por defecto ('Imagen referencial no disponible') manteniendo toda la información técnica.
    """
    response = client.get("/api/v1/catalogo/productos/10/ficha")
    data = response.get_json()

    assert response.status_code == 200
    assert data["sku"] == "ACC-MUST-010"
    assert len(data["galeria_imagenes"]) == 1
    assert data["galeria_imagenes"][0]["es_default"] is True
    assert data["galeria_imagenes"][0]["leyenda"] == "Imagen referencial no disponible"

# =========================================================================
# PRUEBAS DE ACEPTACIÓN - HISTORIA US012 (CA029, CA030)
# =========================================================================

@pytest.mark.acceptance
def test_ca029_sincronizacion_de_precios_y_descuentos_vigentes(client, catalogo_service):
    """
    CA029 - Sincronización de precios y descuentos vigentes:
    Cuando se actualiza el precio o promoción de un producto en la BD central,
    la consulta refleja inmediatamente el precio vigente exacto sin caché obsoleto.
    """
    original = client.get("/api/v1/catalogo/productos/2/precio").get_json()
    try:
        # Simulamos que administración aplica una promoción temporal de 99.50 en BD
        catalogo_service.repo.actualizar_precio_producto(2, original["precio_regular"], 99.50)
        actualizado = client.get("/api/v1/catalogo/productos/2/precio").get_json()
        assert actualizado["en_promocion"] is True
        assert actualizado["precio_vigente_caja"] == 99.50
    finally:
        # Restauramos el precio original en la BD
        catalogo_service.repo.actualizar_precio_producto(2, original["precio_regular"], None)

@pytest.mark.acceptance
def test_ca030_verificacion_de_integridad_de_precios_antes_del_ticket(client):
    """
    CA030 - Verificación de integridad de precios antes del ticket:
    Cuando un cliente tiene productos en su lista temporal con un precio antiguo desfasado,
    el sistema revalida contra la BD central para asegurar coincidencia del 100% con caja.
    """
    lista_temporal_cliente = [
        {"id_producto": 1, "cantidad": 2, "precio_capturado": 145.00},  # En BD tiene promo vigente de 129.90
        {"id_producto": 3, "cantidad": 1, "precio_capturado": 165.00},  # En BD vale 165.00
    ]
    response = client.post("/api/v1/catalogo/precios/verificar-lista", json={"items": lista_temporal_cliente})
    data = response.get_json()

    assert response.status_code == 200
    assert data["integridad_100_caja"] is True
    assert data["hubo_actualizacion_precios"] is True
    # Total esperado: (2 * 129.90) + (1 * 165.00) = 259.80 + 165.00 = 424.80
    assert data["total_sincronizado"] == 424.80
