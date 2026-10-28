import pyodbc
from config.settings import Settings

class DatabaseConnection:
    """Conector transversal hacia Microsoft SQL Server."""

    def __init__(self, server: str = None, database: str = None):
        self.server = server or Settings.DB_SERVER
        self.database = database or Settings.DB_NAME
        self.connection_string = (
            f"DRIVER={{{Settings.ODBC_DRIVER}}};"
            f"SERVER={self.server};"
            f"DATABASE={self.database};"
            f"Trusted_Connection=yes;"
            f"TrustServerCertificate=yes;"
        )

    def get_connection(self) -> pyodbc.Connection:
        return pyodbc.connect(self.connection_string)