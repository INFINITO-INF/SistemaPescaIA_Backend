from flask import Flask, jsonify, render_template
from modules.catalogo_inventario.routes import catalogo_bp
from modules.busqueda_vision.routes import busqueda_bp

def create_app() -> Flask:
    """Factoría de la aplicación monolítica modular (Sprint 1: Backend API + UI Web)."""
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config["JSON_AS_ASCII"] = False

    # Registro de módulos del Sprint 1
    app.register_blueprint(catalogo_bp, url_prefix="/api/v1/catalogo")
    app.register_blueprint(busqueda_bp, url_prefix="/api/v1/busqueda")

    @app.route("/", methods=["GET"])
    def index_ui():
        """Renderiza la interfaz web interactiva del Sprint 1."""
        return render_template("sprint1_ui.html")

    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "OK", "sprint": 1, "arquitectura": "Monolito Modular"}), 200

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="127.0.0.1", port=5000, debug=True)