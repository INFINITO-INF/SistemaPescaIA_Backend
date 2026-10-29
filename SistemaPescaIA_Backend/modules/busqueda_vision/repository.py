from config.database import DatabaseConnection
from config.settings import Settings

class BusquedaRepository:
    """Capa de acceso a datos en SQL Server para búsqueda por texto, etiquetas y categorías."""

    def __init__(self, db: DatabaseConnection = None):
        self.db = db or DatabaseConnection()

    def buscar_productos_por_termino(self, termino: str) -> list:
        """Busca coincidencias por nombre, marca, código SKU o ETIQUETA TÉCNICA indexada."""
        patron = f"%{termino}%"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT DISTINCT
                    p.id_producto, p.sku, p.nombre, p.marca, p.id_categoria,
                    c.nombre AS categoria_nombre,
                    p.precio_unitario, p.precio_promocion, p.stock_actual,
                    COALESCE(ig.url_imagen, ?) AS url_imagen_grupo
                FROM Productos p
                INNER JOIN Categorias c ON p.id_categoria = c.id_categoria
                LEFT JOIN Producto_Etiquetas pe ON p.id_producto = pe.id_producto
                LEFT JOIN Etiquetas_Tecnicas et ON pe.id_etiqueta = et.id_etiqueta
                LEFT JOIN Imagenes_Grupo_Catalogo ig ON p.marca = ig.marca AND p.id_categoria = ig.id_categoria
                WHERE p.activo = 1
                  AND (
                      p.nombre LIKE ?
                      OR p.marca LIKE ?
                      OR p.sku LIKE ?
                      OR et.nombre_etiqueta LIKE ?
                  )
                ORDER BY p.nombre ASC
                """,
                (Settings.DEFAULT_IMAGE_URL, patron, patron, patron, patron),
            )
            return cursor.fetchall()

    def obtener_sugerencias_autocompletado(self, texto_parcial: str) -> list[str]:
        """Sugiere tanto nombres de productos como etiquetas técnicas que coincidan."""
        patron = f"%{texto_parcial}%"
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT TOP 6 sugerencia FROM (
                    SELECT nombre AS sugerencia FROM Productos WHERE activo = 1 AND (nombre LIKE ? OR marca LIKE ?)
                    UNION
                    SELECT N'🏷️ Etiqueta: ' + nombre_etiqueta AS sugerencia FROM Etiquetas_Tecnicas WHERE nombre_etiqueta LIKE ?
                ) AS sub
                ORDER BY sugerencia ASC
                """,
                (patron, patron, patron),
            )
            return [r.sugerencia for r in cursor.fetchall()]

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
                       c.nombre AS categoria_nombre, p.precio_unitario, p.precio_promocion, p.stock_actual,
                       COALESCE(ig.url_imagen, ?) AS url_imagen_grupo
                FROM Productos p
                INNER JOIN Categorias c ON p.id_categoria = c.id_categoria
                LEFT JOIN Imagenes_Grupo_Catalogo ig ON p.marca = ig.marca AND p.id_categoria = ig.id_categoria
                WHERE p.activo = 1 AND (p.id_categoria = ? OR c.id_categoria_padre = ?)
                ORDER BY p.nombre ASC
                """,
                (Settings.DEFAULT_IMAGE_URL, id_categoria, id_categoria),
            )
            return cursor.fetchall()