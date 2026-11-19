from flask import Blueprint, jsonify, request
from modules.administracion.service_admin import AdministracionService

admin_bp = Blueprint("administracion", __name__)
service = AdministracionService()

@admin_bp.route("/autenticar", methods=["POST"])
def autenticar_admin():
    """Valida el PIN del administrador para desbloquear el panel de gestión."""
    data = request.get_json(silent=True) or {}
    pin = data.get("pin", "")
    res = service.autenticar_administrador(pin)
    return jsonify(res), (200 if res["autorizado"] else 401)

@admin_bp.route("/mantenimiento", methods=["GET"])
def consultar_estado_mantenimiento():
    return jsonify(service.obtener_estado_mantenimiento()), 200

@admin_bp.route("/mantenimiento", methods=["POST"])
def cambiar_estado_mantenimiento():
    """US017 / CA040 y CA041: Activa o desactiva el modo mantenimiento validando PIN."""
    data = request.get_json(silent=True) or {}
    activar = bool(data.get("activar", False))
    pin = data.get("pin", "")
    res = service.cambiar_estado_mantenimiento(activar, pin)
    return jsonify(res), (200 if res["autorizado"] else 401)