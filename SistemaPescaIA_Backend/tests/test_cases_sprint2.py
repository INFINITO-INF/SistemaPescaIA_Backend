import io
import pytest
from PIL import Image, ImageDraw
from modules.busqueda_vision.service_vision_ia import VisionIAService
from modules.asesor_ia.service_asesor import AsesorIAService
from modules.administracion.service_admin import AdministracionService


def _crear_imagen_bytes(nitida: bool = True) -> bytes:
    """Helper para generar en memoria una imagen nítida con contraste o una oscura/borrosa."""
    if nitida:
        img = Image.new("RGB", (400, 300), color=(210, 230, 245))
        draw = ImageDraw.Draw(img)
        draw.rectangle([50, 80, 350, 200], fill=(15, 70, 120), outline=(240, 90, 20), width=6)
    else:
        # Imagen completamente oscura y plana (simula captura borrosa/sin luz)
        img = Image.new("RGB", (400, 300), color=(5, 5, 5))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# =========================================================================
# 1. CASOS DE PRUEBA UNITARIOS SPRINT 2
# =========================================================================

@pytest.mark.unit
def test_cp_unit_s2_01_preprocesamiento_imagen_nitida_vs_oscura():
    """TA08-01 (US004): Valida redimensionado 224x224 y detección de calidad de imagen con Pillow."""
    res_nitida = VisionIAService.preprocesar_imagen(_crear_imagen_bytes(nitida=True))
    res_oscura = VisionIAService.preprocesar_imagen(_crear_imagen_bytes(nitida=False))

    assert res_nitida["valida"] is True
    assert res_nitida["dimensiones_normalizadas"] == "224x224"
    assert res_nitida["calidad_aceptable"] is True
    assert res_oscura["valida"] is True
    assert res_oscura["calidad_aceptable"] is False

@pytest.mark.unit
def test_cp_unit_s2_02_evaluacion_umbral_confianza_ia():
    """TA08-02 (US004): Valida el umbral mínimo de confianza (>= 75%)."""
    assert VisionIAService.evaluar_umbral_confianza(75.0) is True
    assert VisionIAService.evaluar_umbral_confianza(92.4) is True
    assert VisionIAService.evaluar_umbral_confianza(74.9) is False

@pytest.mark.unit
def test_cp_unit_s2_03_generador_explicacion_datos_minimos():
    """TA09-02 (US005): Valida explicación sin errores cuando los atributos técnicos son None."""
    datos_minimos = {
        "id_producto": 10,
        "sku": "ACC-MUST-010",
        "nombre": "Pack Anzuelos Mustad #2",
        "marca": "Mustad",
        "categoria": "Accesorios y Anzuelos",
        "descripcion_tecnica": None,
        "resistencia_min_lb": None,
        "resistencia_max_lb": None,
        "peso_gr": 5.0,
        "potencia": None,
        "accion": None,
        "entorno_recomendado": "Ambos",
        "etiquetas": [],
    }
    res = AsesorIAService.construir_explicacion_simplificada(datos_minimos)
    assert res["nivel_detalle"] == "GUIA_GENERAL_CATEGORIA"
    assert len(res["resumen_legible"]) > 20
    assert res["tiempo_generacion_ms"] < 500

@pytest.mark.unit
def test_cp_unit_s2_04_validacion_pin_administrador():
    """TA10-02 (US017): Valida comparación de PIN administrativo."""
    assert AdministracionService.validar_pin("1234", "1234") is True
    assert AdministracionService.validar_pin("0000", "1234") is False
    assert AdministracionService.validar_pin("", "1234") is False


# =========================================================================
# 2. CASOS DE PRUEBA DE INTEGRACIÓN SPRINT 2 (Módulos Python + SQL Server)
# =========================================================================

@pytest.mark.integration
def test_cp_int_s2_01_filtros_tecnicos_combinados_bd(busqueda_service):
    """TA07-02 (US003): Verifica intersección de marca, resistencia y precio máximo contra SQL Server."""
    res = busqueda_service.filtrar_por_atributos_tecnicos({
        "marca": "Shimano",
        "resistencia_min_lb": 10,
        "precio_max": 150,
    })
    assert res["tuvo_resultados"] is True
    assert all(p["marca"] == "Shimano" and p["precio_vigente"] <= 150 for p in res["resultados"])

@pytest.mark.integration
def test_cp_int_s2_02_integracion_vision_ia_con_stock_bd(vision_service):
    """TA08-03 y TA10-03 (US004): Verifica enlace del clasificador visual con inventario en BD."""
    res = vision_service.identificar_producto_desde_imagen(_crear_imagen_bytes(True), "carrete_shimano_sienna.jpg")
    assert res["identificado"] is True
    assert res["confianza"] >= 75.0
    assert res["estado_stock_principal"] == "Disponible en tienda"
    assert len(res["coincidencias"]) >= 1

@pytest.mark.integration
def test_cp_int_s2_03_integracion_asesor_ia_ficha_bd(asesor_service):
    """TA09-01 y TA09-03 (US005): Verifica extracción de BD y tiempo de respuesta de explicación técnica."""
    res = asesor_service.generar_explicacion_producto(1)
    assert res is not None
    assert res["nivel_detalle"] == "EXPLICACION_TECNICA_COMPLETA"
    assert "Shimano" in res["resumen_legible"]
    assert res["tiempo_generacion_ms"] < 1000
