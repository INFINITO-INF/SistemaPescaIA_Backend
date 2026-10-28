from flask import Blueprint, jsonify, request
from modules.busqueda_vision.service_busqueda import BusquedaService

busqueda_bp = Blueprint("busqueda_vision", __name__)
service = BusquedaService()

@busqueda_bp.route("/texto", methods=["GET"])
def buscar_por_texto():
    termino = request.args.get("q", "")
    res = service.buscar_por_texto(termino)
    return jsonify(res), 200

@busqueda_bp.route("/autocompletar", methods=["GET"])
def autocompletar():
    texto = request.args.get("q", "")
    res = service.autocompletar(texto)
    return jsonify(res), 200

@busqueda_bp.route("/limpiar", methods=["POST"])
def limpiar_busqueda():
    res = service.limpiar_campo_busqueda()
    return jsonify(res), 200

@busqueda_bp.route("/categorias", methods=["GET"])
def listar_categorias_principales():
    res = service.listar_categorias_principales()
    return jsonify({"categorias_principales": res}), 200

@busqueda_bp.route("/categorias/<int:id_categoria>/productos", methods=["GET"])
def filtrar_por_categoria(id_categoria: int):
    res = service.seleccionar_categoria(id_categoria)
    return jsonify(res), 200

@busqueda_bp.route("/categorias/volver", methods=["POST"])
def volver_menu_categorias():
    res = service.volver_menu_principal_categorias()
    return jsonify(res), 200
