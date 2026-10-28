from flask import Flask, jsonify
from modules.catalogo_inventario.routes import catalogo_bp
from modules.busqueda_vision.routes import busqueda_bp

def create_app() -> Flask:
    """Factoría de la aplicación monolítica modular (Sprint 1)."""
    app = Flask(__name__)
    app.config["JSON_AS_ASCII"] = False

    # Registro de módulos del Sprint 1
    app.register_blueprint(catalogo_bp, url_prefix="/api/v1/catalogo")
    app.register_blueprint(busqueda_bp, url_prefix="/api/v1/busqueda")

    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "OK", "sprint": 1, "arquitectura": "Monolito Modular"}), 200

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="127.0.0.1", port=5000, debug=True)
