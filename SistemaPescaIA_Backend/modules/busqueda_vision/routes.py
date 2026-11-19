from flask import Blueprint, jsonify, request
from modules.busqueda_vision.service_busqueda import BusquedaService
from modules.busqueda_vision.service_vision_ia import VisionIAService

busqueda_bp = Blueprint("busqueda_vision", __name__)
service = BusquedaService()
vision_service = VisionIAService()

# --- Rutas Sprint 1 (US001 y US002) ---
@busqueda_bp.route("/texto", methods=["GET"])
def buscar_por_texto():
    termino = request.args.get("q", "")
    return jsonify(service.buscar_por_texto(termino)), 200

@busqueda_bp.route("/autocompletar", methods=["GET"])
def autocompletar():
    texto = request.args.get("q", "")
    return jsonify(service.autocompletar(texto)), 200

@busqueda_bp.route("/limpiar", methods=["POST"])
def limpiar_busqueda():
    return jsonify(service.limpiar_campo_busqueda()), 200

@busqueda_bp.route("/categorias", methods=["GET"])
def listar_categorias_principales():
    return jsonify({"categorias_principales": service.listar_categorias_principales()}), 200

@busqueda_bp.route("/categorias/<int:id_categoria>/productos", methods=["GET"])
def filtrar_por_categoria(id_categoria: int):
    return jsonify(service.seleccionar_categoria(id_categoria)), 200

@busqueda_bp.route("/categorias/volver", methods=["POST"])
def volver_menu_categorias():
    return jsonify(service.volver_menu_principal_categorias()), 200

# --- RUTAS SPRINT 2 (US003: Filtros Técnicos y US004: Visión IA) ---
@busqueda_bp.route("/filtros/opciones", methods=["GET"])
def opciones_filtros_tecnicos():
    return jsonify(service.obtener_opciones_filtros()), 200

@busqueda_bp.route("/filtros", methods=["POST"])
def aplicar_filtros_tecnicos():
    filtros = request.get_json(silent=True) or {}
    return jsonify(service.filtrar_por_atributos_tecnicos(filtros)), 200

@busqueda_bp.route("/imagen", methods=["POST"])
def identificar_por_imagen():
    if "imagen" not in request.files:
        return jsonify({"identificado": False, "mensaje": "Debe adjuntar un archivo en el campo 'imagen'"}), 400
    archivo = request.files["imagen"]
    imagen_bytes = archivo.read()
    resultado = vision_service.identificar_producto_desde_imagen(imagen_bytes, archivo.filename or "")
    return jsonify(resultado), 200