import io
import pytest
from PIL import Image, ImageDraw


def _imagen_prueba(nitida: bool = True) -> io.BytesIO:
    if nitida:
        img = Image.new("RGB", (320, 240), color=(220, 235, 250))
        draw = ImageDraw.Draw(img)
        draw.ellipse([60, 40, 260, 200], fill=(20, 90, 140), outline=(230, 80, 20), width=5)
    else:
        img = Image.new("RGB", (320, 240), color=(4, 4, 4))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


# =========================================================================
# PRUEBAS DE ACEPTACIÓN - HISTORIA US003 (CA008, CA009)
# =========================================================================

@pytest.mark.acceptance
def test_ca008_aplicacion_combinada_de_filtros_tecnicos(client):
    """
    CA008 - Aplicación combinada de filtros técnicos:
    Cuando el cliente aplica filtros combinados (marca='Shimano', resistencia_min_lb=10, precio_max=140),
    el sistema intersecta los filtros y muestra solo productos que cumplen todos los criterios.
    """
    payload = {
        "marca": "Shimano",
        "resistencia_min_lb": 10,
        "precio_max": 140,
    }
    response = client.post("/api/v1/busqueda/filtros", json=payload)
    data = response.get_json()

    assert response.status_code == 200
    assert data["tuvo_resultados"] is True
    assert len(data["resultados"]) >= 1
    assert all(p["marca"] == "Shimano" and p["precio_vigente"] <= 140 for p in data["resultados"])

@pytest.mark.acceptance
def test_ca009_reajuste_de_filtros_sin_coincidencias(client):
    """
    CA009 - Limpieza o reajuste de filtros sin coincidencias:
    Cuando la combinación de filtros no arroja resultados compatibles, el sistema informa que no hay
    coincidencias exactas y habilita el botón 'Restablecer filtros'.
    """
    payload = {
        "marca": "Rapala",
        "precio_min": 5000,
    }
    response = client.post("/api/v1/busqueda/filtros", json=payload)
    data = response.get_json()

    assert response.status_code == 200
    assert data["tuvo_resultados"] is False
    assert "No hay coincidencias exactas" in data["mensaje"]
    assert data["habilitar_restablecer_filtros"] is True
    assert data["resultados"] == []


# =========================================================================
# PRUEBAS DE ACEPTACIÓN - HISTORIA US004 (CA010, CA011, CA012)
# =========================================================================

@pytest.mark.acceptance
def test_ca010_identificacion_visual_exitosa_con_stock(client):
    """
    CA010 - Identificación visual exitosa con stock:
    Cuando el cliente sube una foto nítida de un artículo ('senuelo_rapala_trucha.jpg') y el modelo supera >= 75%,
    clasifica el producto, muestra coincidencias de la BD e indica su stock disponible.
    """
    response = client.post(
        "/api/v1/busqueda/imagen",
        data={"imagen": (_imagen_prueba(nitida=True), "senuelo_rapala_trucha.jpg")},
        content_type="multipart/form-data",
    )
    data = response.get_json()

    assert response.status_code == 200
    assert data["identificado"] is True
    assert data["confianza"] >= 75.0
    assert data["estado_stock_principal"] == "Disponible en tienda"
    assert data["coincidencias"][0]["stock_actual"] > 0

@pytest.mark.acceptance
def test_ca011_producto_identificado_visualmente_pero_agotado(client):
    """
    CA011 - Producto identificado visualmente pero agotado:
    Cuando el modelo reconoce un producto con stock = 0 ('senuelo_yozuri_mar.jpg' -> SEN-YOM-008),
    muestra la etiqueta 'Agotado' y sugiere productos alternativos disponibles de la misma categoría.
    """
    response = client.post(
        "/api/v1/busqueda/imagen",
        data={"imagen": (_imagen_prueba(nitida=True), "senuelo_yozuri_mar.jpg")},
        content_type="multipart/form-data",
    )
    data = response.get_json()

    assert response.status_code == 200
    assert data["identificado"] is True
    assert data["estado_stock_principal"] == "Agotado"
    assert data["coincidencias"][0]["sku"] == "SEN-YOM-008"
    assert data["coincidencias"][0]["stock_actual"] == 0
    assert len(data["alternativos_disponibles"]) >= 1
    assert all(a["stock_actual"] > 0 for a in data["alternativos_disponibles"])

@pytest.mark.acceptance
def test_ca012_imagen_irreconocible_o_inferior_al_umbral(client):
    """
    CA012 - Imagen irreconocible o inferior al umbral:
    Cuando el usuario proporciona una imagen oscura/borrosa o ajena a pesca (< 75%),
    el sistema notifica 'No se pudo identificar el artículo con claridad'.
    """
    response = client.post(
        "/api/v1/busqueda/imagen",
        data={"imagen": (_imagen_prueba(nitida=False), "foto_oscura_borrosa.jpg")},
        content_type="multipart/form-data",
    )
    data = response.get_json()

    assert response.status_code == 200
    assert data["identificado"] is False
    assert data["confianza"] < 75.0
    assert data["mensaje"] == "No se pudo identificar el artículo con claridad"


# =========================================================================
# PRUEBAS DE ACEPTACIÓN - HISTORIA US005 (CA013, CA014)
# =========================================================================

@pytest.mark.acceptance
def test_ca013_generacion_de_explicacion_tecnica_legible(client):
    """
    CA013 - Generación de explicación técnica legible:
    Al solicitar la explicación de uso del Producto 1, el módulo asesor_ia procesa las especificaciones
    de la BD y devuelve un resumen legible, ventajas clave y modalidad recomendada.
    """
    response = client.get("/api/v1/asesor/productos/1/explicacion")
    data = response.get_json()

    assert response.status_code == 200
    assert data["nivel_detalle"] == "EXPLICACION_TECNICA_COMPLETA"
    assert len(data["resumen_legible"]) > 30
    assert len(data["ventajas_clave"]) >= 1
    assert data["modalidad_recomendada"] != ""

@pytest.mark.acceptance
def test_ca014_producto_con_datos_tecnicos_minimos_en_bd(client):
    """
    CA014 - Producto con datos técnicos mínimos en BD:
    Al solicitar la explicación del Producto 10 (que tiene atributos técnicos en NULL),
    genera una guía general basada en su categoría sin errores ni textos vacíos.
    """
    response = client.get("/api/v1/asesor/productos/10/explicacion")
    data = response.get_json()

    assert response.status_code == 200
    assert data["nivel_detalle"] == "GUIA_GENERAL_CATEGORIA"
    assert "Accesorios y Anzuelos" in data["resumen_legible"]
    assert len(data["ventajas_clave"]) >= 1


# =========================================================================
# PRUEBAS DE ACEPTACIÓN - HISTORIA US017 (CA040, CA041)
# =========================================================================

@pytest.mark.acceptance
def test_ca040_y_ca041_bloqueo_mantenimiento_y_restablecimiento_con_pin(client):
    """
    CA040 y CA041 - Bloqueo de interfaz por mantenimiento y restablecimiento validando PIN:
    1. Activa mantenimiento con PIN válido ('1234') -> bloquea búsqueda pública (HTTP 503).
    2. Rechaza desbloqueo con PIN erróneo ('9999') -> HTTP 401 y mantiene bloqueo.
    3. Reactiva servicio con PIN válido ('1234') -> desbloquea el catálogo público (HTTP 200).
    """
    try:
        # Paso 1 (CA040): Activar mantenimiento
        res_activar = client.post("/api/v1/admin/mantenimiento", json={"activar": True, "pin": "1234"})
        assert res_activar.status_code == 200
        assert res_activar.get_json()["modo_mantenimiento"] is True

        # Verificar que el catálogo público queda bloqueado con el aviso esperado
        res_bloqueada = client.get("/api/v1/busqueda/texto?q=Shimano")
        assert res_bloqueada.status_code == 503
        assert res_bloqueada.get_json()["mensaje"] == "Sistema en actualización, consulte en mostrador"

        # Paso 2 (CA041 - PIN erróneo): Rechaza el desbloqueo
        res_pin_malo = client.post("/api/v1/admin/mantenimiento", json={"activar": False, "pin": "9999"})
        assert res_pin_malo.status_code == 401
        assert res_pin_malo.get_json()["autorizado"] is False
        assert res_pin_malo.get_json()["modo_mantenimiento"] is True

        # Paso 3 (CA041 - PIN correcto): Restablece el servicio
        res_desactivar = client.post("/api/v1/admin/mantenimiento", json={"activar": False, "pin": "1234"})
        assert res_desactivar.status_code == 200
        assert res_desactivar.get_json()["modo_mantenimiento"] is False

        # Verificar que el catálogo público responde normalmente de nuevo
        res_normal = client.get("/api/v1/busqueda/texto?q=Shimano")
        assert res_normal.status_code == 200
    finally:
        # Garantizar que el kiosco quede operativo incluso si una aserción fallara
        client.post("/api/v1/admin/mantenimiento", json={"activar": False, "pin": "1234"})