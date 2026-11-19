from flask import Flask, jsonify, render_template, request
from modules.catalogo_inventario.routes import catalogo_bp
from modules.busqueda_vision.routes import busqueda_bp
from modules.asesor_ia.routes import asesor_bp
from modules.administracion.routes import admin_bp
from modules.administracion.service_admin import AdministracionService

def create_app() -> Flask:
    """Factoría de la aplicación monolítica modular."""
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config["JSON_AS_ASCII"] = False

    admin_service = AdministracionService()

    # Registro de módulos independientes (Blueprints)
    app.register_blueprint(catalogo_bp, url_prefix="/api/v1/catalogo")
    app.register_blueprint(busqueda_bp, url_prefix="/api/v1/busqueda")
    app.register_blueprint(asesor_bp, url_prefix="/api/v1/asesor")
    app.register_blueprint(admin_bp, url_prefix="/api/v1/admin")

    @app.before_request
    def verificar_modo_mantenimiento():
        """US017 / CA040: Bloquea consultas públicas del kiosco si el modo mantenimiento está activo."""
        rutas_publicas_bloqueables = ("/api/v1/busqueda", "/api/v1/asesor")
        if request.path.startswith(rutas_publicas_bloqueables):
            estado = admin_service.obtener_estado_mantenimiento()
            if estado["modo_mantenimiento"]:
                return jsonify({
                    "bloqueado": True,
                    "modo_mantenimiento": True,
                    "mensaje": estado["mensaje_mantenimiento"],
                }), 503

    @app.route("/", methods=["GET"])
    def index_ui():
        """Vista pública del Kiosco de Clientes."""
        return render_template("ui.html")

    @app.route("/admin", methods=["GET"])
    def admin_ui():
        """Vista protegida de Gestión de Catálogo y Control Operativo para Administradores."""
        return render_template("admin.html")

    @app.route("/health", methods=["GET"])
    def health_check():
        estado = admin_service.obtener_estado_mantenimiento()
        return jsonify({
            "status": "MAINTENANCE" if estado["modo_mantenimiento"] else "OK",
            "sprint": 2,
            "arquitectura": "Monolito Modular",
            "modo_mantenimiento": estado["modo_mantenimiento"],
        }), 200

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="127.0.0.1", port=5000, debug=True)