import os

class Settings:
    """Parámetros globales de configuración del sistema."""
    # Cambia a "localhost\\SQLEXPRESS" si usas SQL Server Express
    DB_SERVER = os.getenv("PESCA_DB_SERVER", "localhost")
    DB_NAME = os.getenv("PESCA_DB_NAME", "TiendaPescaIA_DB")
    ODBC_DRIVER = os.getenv("PESCA_ODBC_DRIVER", "ODBC Driver 17 for SQL Server")
    DEFAULT_IMAGE_URL = "/static/img/default_no_image.jpg"
    MIN_AUTOCOMPLETE_CHARS = 3
