from flask import Blueprint, jsonify
from modules.asesor_ia.service_asesor import AsesorIAService

asesor_bp = Blueprint("asesor_ia", __name__)
service = AsesorIAService()

@asesor_bp.route("/productos/<int:id_producto>/explicacion", methods=["GET"])
def obtener_explicacion_tecnica(id_producto: int):
    res = service.generar_explicacion_producto(id_producto)
    if not res:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify(res), 200
