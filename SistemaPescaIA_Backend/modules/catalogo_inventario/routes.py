from flask import Blueprint, jsonify, request
from modules.catalogo_inventario.service import CatalogoInventarioService

catalogo_bp = Blueprint("catalogo_inventario", __name__)
service = CatalogoInventarioService()

@catalogo_bp.route("/etiquetas/sugerir", methods=["POST"])
def sugerir_etiquetas():
    data = request.get_json(silent=True) or {}
    descripcion = data.get("descripcion_tecnica", "")
    sugerencias = service.sugerir_etiquetas_ia(descripcion)
    return jsonify({"sugerencias": sugerencias}), 200

@catalogo_bp.route("/productos/<int:id_producto>/etiquetas", methods=["POST"])
def asignar_etiqueta(id_producto: int):
    data = request.get_json(silent=True) or {}
    id_etiqueta = data.get("id_etiqueta")
    if not id_etiqueta:
        return jsonify({"error": "id_etiqueta es requerido"}), 400
    res = service.asignar_etiqueta_manual(id_producto, int(id_etiqueta))
    status = 200 if res["indexado"] else 404
    return jsonify(res), status

@catalogo_bp.route("/productos/<int:id_producto>/etiquetas", methods=["PUT"])
def actualizar_etiquetas(id_producto: int):
    data = request.get_json(silent=True) or {}
    ids_etiquetas = data.get("ids_etiquetas", [])
    res = service.actualizar_etiquetas_producto(id_producto, ids_etiquetas)
    status = 200 if res["actualizado"] else 404
    return jsonify(res), status

@catalogo_bp.route("/productos/<int:id_producto>/stock", methods=["GET"])
def consultar_stock(id_producto: int):
    res = service.consultar_disponibilidad_tiempo_real(id_producto)
    if not res:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify(res), 200

@catalogo_bp.route("/productos/<int:id_producto>/ficha", methods=["GET"])
def obtener_ficha(id_producto: int):
    res = service.obtener_ficha_tecnica_y_galeria(id_producto)
    if not res:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify(res), 200

@catalogo_bp.route("/productos/<int:id_producto>/precio", methods=["GET"])
def consultar_precio(id_producto: int):
    res = service.consultar_precio_sincronizado(id_producto)
    if not res:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify(res), 200

@catalogo_bp.route("/precios/verificar-lista", methods=["POST"])
def verificar_precios_lista():
    data = request.get_json(silent=True) or {}
    items = data.get("items", [])
    res = service.verificar_integridad_precios_lista(items)
    return jsonify(res), 200
