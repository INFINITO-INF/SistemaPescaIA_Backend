import pytest
from types import SimpleNamespace
from modules.catalogo_inventario.service import CatalogoInventarioService
from modules.busqueda_vision.service_busqueda import BusquedaService

# =========================================================================
# 1. CASOS DE PRUEBA UNITARIOS (Lógica pura aislada sin tocar SQL Server)
# =========================================================================

@pytest.mark.unit
def test_cp_unit_01_evaluar_regla_stock_disponible():
    """CP-UNIT-01 (US010): Verifica que stock > 0 retorne indicador verde y botón habilitado."""
    resultado = CatalogoInventarioService.evaluar_regla_stock(8)
    assert resultado["stock_actual"] == 8
    assert resultado["leyenda"] == "Disponible en tienda"
    assert resultado["indicador_color"] == "verde"
    assert resultado["boton_agregar_habilitado"] is True

@pytest.mark.unit
def test_cp_unit_02_evaluar_regla_stock_agotado():
    """CP-UNIT-02 (US010): Verifica que stock = 0 retorne 'Agotado' y bloquee el botón."""
    resultado = CatalogoInventarioService.evaluar_regla_stock(0)
    assert resultado["stock_actual"] == 0
    assert resultado["leyenda"] == "Agotado"
    assert resultado["indicador_color"] == "rojo"
    assert resultado["boton_agregar_habilitado"] is False

@pytest.mark.unit
def test_cp_unit_03_sugerir_etiquetas_ia_con_descripcion():
    """CP-UNIT-03 (US009): Verifica extracción de etiquetas técnicas desde texto descriptivo."""
    descripcion = "Caña ligera para pesca de trucha en río bajo modalidad spinning."
    etiquetas = CatalogoInventarioService.sugerir_etiquetas_ia(descripcion)
    nombres = [e["nombre_etiqueta"] for e in etiquetas]
    assert "Trucha" in nombres
    assert "Spinning" in nombres
    assert "Agua Dulce / Río" in nombres

@pytest.mark.unit
def test_cp_unit_04_sugerir_etiquetas_ia_texto_vacio():
    """CP-UNIT-04 (US009): Verifica manejo seguro cuando la descripción está vacía."""
    assert CatalogoInventarioService.sugerir_etiquetas_ia("") == []
    assert CatalogoInventarioService.sugerir_etiquetas_ia(None) == []

@pytest.mark.unit
def test_cp_unit_05_calculo_precio_con_y_sin_promocion():
    """CP-UNIT-05 (US012): Verifica cálculo de precio de cobro en caja."""
    con_promo = CatalogoInventarioService.calcular_precio_vigente(145.00, 129.90)
    sin_promo = CatalogoInventarioService.calcular_precio_vigente(110.00, None)
    assert con_promo["en_promocion"] is True
    assert con_promo["precio_vigente_caja"] == 129.90
    assert sin_promo["en_promocion"] is False
    assert sin_promo["precio_vigente_caja"] == 110.00

@pytest.mark.unit
def test_cp_unit_06_validacion_longitud_minima_autocompletado():
    """CP-UNIT-06 (US001): Verifica regla de mínimo 3 caracteres para autocompletar."""
    assert BusquedaService.validar_minimo_autocompletado("Sh") is False
    assert BusquedaService.validar_minimo_autocompletado("Shi") is True

@pytest.mark.unit
def test_cp_unit_07_sugerir_etiquetas_ia_normaliza_mayusculas_y_evita_duplicados():
    """CP-UNIT-07 (US009): Verifica búsqueda sin distinguir mayúsculas y etiquetas únicas por ID."""
    etiquetas = CatalogoInventarioService.sugerir_etiquetas_ia(
        "TRUCHA para pescar en río y laguna con SPINNING"
    )
    ids = [etiqueta["id_etiqueta"] for etiqueta in etiquetas]

    assert ids == [1, 4, 6]

@pytest.mark.unit
def test_cp_unit_08_calcular_precio_ignora_promocion_igual_o_superior():
    """CP-UNIT-08 (US012): Verifica que una promoción sin descuento no modifica el precio de cobro."""
    precio_igual = CatalogoInventarioService.calcular_precio_vigente(100, 100)
    precio_superior = CatalogoInventarioService.calcular_precio_vigente(100, 125)

    assert precio_igual["en_promocion"] is False
    assert precio_igual["precio_promocion"] is None
    assert precio_igual["precio_vigente_caja"] == 100.0
    assert precio_superior["en_promocion"] is False
    assert precio_superior["precio_vigente_caja"] == 100.0

@pytest.mark.unit
def test_cp_unit_09_validacion_autocompletado_rechaza_vacios_y_espacios():
    """CP-UNIT-09 (US001): Verifica que texto nulo, vacío o con espacios no active autocompletado."""
    assert BusquedaService.validar_minimo_autocompletado(None) is False
    assert BusquedaService.validar_minimo_autocompletado("") is False
    assert BusquedaService.validar_minimo_autocompletado("  Sh  ") is False

@pytest.mark.unit
def test_cp_unit_10_busqueda_sin_termino_restablece_el_catalogo():
    """CP-UNIT-10 (US001): Verifica que un término vacío delegue en la limpieza de búsqueda."""
    categorias = [SimpleNamespace(id_categoria=1, nombre="Cañas", descripcion="Cañas de pesca")]
    repo = SimpleNamespace(
        obtener_categorias_principales=lambda: categorias,
        buscar_productos_por_termino=lambda _: pytest.fail("No debe consultar productos"),
    )

    resultado = BusquedaService(repo).buscar_por_texto("   ")

    assert resultado["termino_buscado"] == ""
    assert resultado["resultados"] == []
    assert resultado["categorias_principales"][0]["id_categoria"] == 1

@pytest.mark.unit
def test_cp_unit_11_consultar_stock_devuelve_none_si_producto_no_existe():
    """CP-UNIT-11 (US010): Verifica que la ausencia del producto no genere un estado de inventario."""
    repo = SimpleNamespace(obtener_stock_producto=lambda _: None)

    assert CatalogoInventarioService(repo).consultar_disponibilidad_tiempo_real(999) is None

@pytest.mark.unit
def test_cp_unit_12_asignar_etiqueta_retorna_error_si_repositorio_rechaza_datos():
    """CP-UNIT-12 (US009): Verifica el resultado de negocio cuando producto o etiqueta no son válidos."""
    repo = SimpleNamespace(vincular_etiqueta_producto=lambda *_: False)

    resultado = CatalogoInventarioService(repo).asignar_etiqueta_manual(999, 999)

    assert resultado == {"indexado": False, "mensaje": "Producto o etiqueta no válidos"}

@pytest.mark.unit
def test_cp_unit_13_actualizar_etiquetas_retorna_error_si_producto_no_existe():
    """CP-UNIT-13 (US009): Verifica el error al actualizar etiquetas de un producto inexistente."""
    repo = SimpleNamespace(reemplazar_etiquetas_producto=lambda *_: False)

    resultado = CatalogoInventarioService(repo).actualizar_etiquetas_producto(999, [])

    assert resultado == {"actualizado": False, "mensaje": "Producto no encontrado"}

@pytest.mark.unit
def test_cp_unit_14_verificar_precios_omite_producto_inexistente_y_conserva_total():
    """CP-UNIT-14 (US030): Verifica que una línea inexistente se omita sin alterar el subtotal válido."""
    fila = SimpleNamespace(
        id_producto=1,
        sku="SKU-001",
        nombre="Producto",
        precio_unitario=80,
        precio_promocion=None,
    )
    repo = SimpleNamespace(
        obtener_precios_producto=lambda id_producto: fila if id_producto == 1 else None,
    )
    items = [
        {"id_producto": 1, "cantidad": 2, "precio_capturado": 80},
        {"id_producto": 999, "cantidad": 1, "precio_capturado": 10},
    ]

    resultado = CatalogoInventarioService(repo).verificar_integridad_precios_lista(items)

    assert resultado["total_sincronizado"] == 160.0
    assert resultado["hubo_actualizacion_precios"] is False
    assert len(resultado["items"]) == 1

# =========================================================================
# 2. CASOS DE PRUEBA DE INTEGRACIÓN (Servicios Python + SQL Server Placebo)
# =========================================================================

@pytest.mark.integration
def test_cp_int_01_conexion_y_lectura_stock_bd(catalogo_service):
    """CP-INT-01 (US010): Verifica lectura de stock real desde SQL Server."""
    prod_con_stock = catalogo_service.consultar_disponibilidad_tiempo_real(1)
    prod_sin_stock = catalogo_service.consultar_disponibilidad_tiempo_real(8)
    assert prod_con_stock is not None and prod_con_stock["stock_actual"] > 0
    assert prod_sin_stock is not None and prod_sin_stock["stock_actual"] == 0

@pytest.mark.integration
def test_cp_int_02_extraccion_ficha_con_y_sin_imagenes_bd(catalogo_service):
    """CP-INT-02 (US011): Verifica consulta JOIN entre Productos, Categorias e Imagenes_Producto."""
    ficha_completa = catalogo_service.obtener_ficha_tecnica_y_galeria(1)
    ficha_sin_foto = catalogo_service.obtener_ficha_tecnica_y_galeria(10)
    assert len(ficha_completa["galeria_imagenes"]) == 2
    assert ficha_completa["galeria_imagenes"][0]["es_default"] is False
    assert ficha_sin_foto["galeria_imagenes"][0]["es_default"] is True

@pytest.mark.integration
def test_cp_int_03_busqueda_sql_por_marca_y_sku(busqueda_service):
    """CP-INT-03 (US001): Verifica búsqueda en SQL Server tanto por marca como por código SKU."""
    por_marca = busqueda_service.buscar_por_texto("Shimano")
    por_sku = busqueda_service.buscar_por_texto("SEN-RAP-007")
    assert por_marca["tuvo_resultados"] is True
    assert len(por_marca["resultados"]) >= 3
    assert por_sku["tuvo_resultados"] is True
    assert por_sku["resultados"][0]["nombre"] == "Señuelo Rapala Countdown CD07 Trucha"

@pytest.mark.unit
def test_cp_unit_07_regla_cupon_100_bloquea_menores_o_iguales_a_100():
    """Verifica que un cupón fijo de S/ 100 bloquee productos de S/ 100 o menos y acepte de S/ 101 a más."""
    bloqueado_100 = CatalogoInventarioService.evaluar_elegibilidad_cupon(100.00, "MONTO_FIJO", 100.00)
    bloqueado_95 = CatalogoInventarioService.evaluar_elegibilidad_cupon(95.00, "MONTO_FIJO", 100.00)
    permitido_101 = CatalogoInventarioService.evaluar_elegibilidad_cupon(101.00, "MONTO_FIJO", 100.00)

    assert bloqueado_100["elegible"] is False
    assert bloqueado_95["elegible"] is False
    assert permitido_101["elegible"] is True
    assert permitido_101["nuevo_precio_promocion"] == 1.00

@pytest.mark.unit
def test_cp_unit_08_regla_cupon_2x1_permite_llegar_a_cero():
    """Verifica que un cupón PROMO_2X1 permita que un producto de S/ 100 llegue a S/ 0.00."""
    promo_2x1 = CatalogoInventarioService.evaluar_elegibilidad_cupon(100.00, "PROMO_2X1", 100.00)
    assert promo_2x1["elegible"] is True
    assert promo_2x1["nuevo_precio_promocion"] == 0.00

@pytest.mark.integration
def test_cp_int_04_busqueda_directa_por_etiqueta_tecnica(busqueda_service):
    """Verifica que al buscar el nombre de una etiqueta ('Surfcasting'), retorne los productos etiquetados."""
    res = busqueda_service.buscar_por_texto("Surfcasting")
    assert res["tuvo_resultados"] is True
    skus = [p["sku"] for p in res["resultados"]]
    assert "SEN-SHI-009" in skus

@pytest.mark.integration
def test_cp_int_05_herencia_imagen_por_grupo_marca_y_categoria(catalogo_service):
    """Verifica que dos cañas Shimano con SKUs distintos compartan la imagen del grupo Shimano + Cañas."""
    ficha_cana_1 = catalogo_service.obtener_ficha_tecnica_y_galeria(1)
    ficha_cana_11 = catalogo_service.obtener_ficha_tecnica_y_galeria(11)
    assert ficha_cana_1["galeria_imagenes"][0]["url_imagen"] == "/static/img/grupos/shimano_canas.jpg"
    assert ficha_cana_11["galeria_imagenes"][0]["url_imagen"] == "/static/img/grupos/shimano_canas.jpg"