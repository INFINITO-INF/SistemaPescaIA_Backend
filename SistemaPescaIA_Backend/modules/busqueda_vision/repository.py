from config.database import DatabaseConnection

class BusquedaRepository:
    """Capa de acceso a datos en SQL Server para búsqueda por texto y categorías."""

    def __init__(self, db: DatabaseConnection = None):
        self.db = db or DatabaseConnection()

    def buscar_productos_por_termino(self, termino: str) -> list:
        patron = f"%{termino}%"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id_producto, sku, nombre, marca, precio_unitario, precio_promocion, stock_actual
                FROM Productos
                WHERE activo = 1 AND (nombre LIKE ? OR marca LIKE ? OR sku LIKE ?)
                ORDER BY nombre ASC
                """,
                (patron, patron, patron),
            )
            return cursor.fetchall()

    def obtener_sugerencias_autocompletado(self, texto_parcial: str) -> list[str]:
        patron = f"%{texto_parcial}%"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT TOP 5 nombre
                FROM Productos
                WHERE activo = 1 AND (nombre LIKE ? OR marca LIKE ?)
                ORDER BY nombre ASC
                """,
                (patron, patron),
            )
            return [r.nombre for r in cursor.fetchall()]

    def obtener_categorias_principales(self) -> list:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id_categoria, nombre, descripcion
                FROM Categorias
                WHERE id_categoria_padre IS NULL AND activo = 1
                ORDER BY id_categoria ASC
                """
            )
            return cursor.fetchall()

    def obtener_subcategorias(self, id_categoria_padre: int) -> list:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id_categoria, nombre, descripcion
                FROM Categorias
                WHERE id_categoria_padre = ? AND activo = 1
                ORDER BY id_categoria ASC
                """,
                (id_categoria_padre,),
            )
            return cursor.fetchall()

    def obtener_productos_por_categoria(self, id_categoria: int) -> list:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT p.id_producto, p.sku, p.nombre, p.marca, p.id_categoria,
                       c.nombre AS categoria_nombre, p.precio_unitario, p.precio_promocion, p.stock_actual
                FROM Productos p
                INNER JOIN Categorias c ON p.id_categoria = c.id_categoria
                WHERE p.activo = 1 AND (p.id_categoria = ? OR c.id_categoria_padre = ?)
                ORDER BY p.nombre ASC
                """,
                (id_categoria, id_categoria),
            )
            return cursor.fetchall()
