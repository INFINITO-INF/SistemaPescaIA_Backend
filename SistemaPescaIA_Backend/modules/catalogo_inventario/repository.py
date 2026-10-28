from config.database import DatabaseConnection

class CatalogoRepository:
    """Capa de acceso a datos en SQL Server para el módulo catalogo_inventario."""

    def __init__(self, db: DatabaseConnection = None):
        self.db = db or DatabaseConnection()

    def obtener_etiquetas_por_producto(self, id_producto: int) -> list[dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT e.id_etiqueta, e.nombre_etiqueta, e.tipo_etiqueta
                FROM Etiquetas_Tecnicas e
                INNER JOIN Producto_Etiquetas pe ON e.id_etiqueta = pe.id_etiqueta
                WHERE pe.id_producto = ?
                ORDER BY e.id_etiqueta ASC
                """,
                (id_producto,),
            )
            return [
                {
                    "id_etiqueta": r.id_etiqueta,
                    "nombre_etiqueta": r.nombre_etiqueta,
                    "tipo_etiqueta": r.tipo_etiqueta,
                }
                for r in cursor.fetchall()
            ]

    def vincular_etiqueta_producto(self, id_producto: int, id_etiqueta: int) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM Productos WHERE id_producto = ?", (id_producto,))
            if not cursor.fetchone():
                return False

            cursor.execute("SELECT 1 FROM Etiquetas_Tecnicas WHERE id_etiqueta = ?", (id_etiqueta,))
            if not cursor.fetchone():
                return False

            cursor.execute(
                """
                IF NOT EXISTS (
                    SELECT 1 FROM Producto_Etiquetas WHERE id_producto = ? AND id_etiqueta = ?
                )
                INSERT INTO Producto_Etiquetas (id_producto, id_etiqueta) VALUES (?, ?)
                """,
                (id_producto, id_etiqueta, id_producto, id_etiqueta),
            )
            conn.commit()
            return True

    def reemplazar_etiquetas_producto(self, id_producto: int, ids_etiquetas: list[int]) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM Productos WHERE id_producto = ?", (id_producto,))
            if not cursor.fetchone():
                return False

            cursor.execute("DELETE FROM Producto_Etiquetas WHERE id_producto = ?", (id_producto,))
            for id_etiq in ids_etiquetas:
                cursor.execute(
                    "INSERT INTO Producto_Etiquetas (id_producto, id_etiqueta) VALUES (?, ?)",
                    (id_producto, id_etiq),
                )
            conn.commit()
            return True

    def obtener_stock_producto(self, id_producto: int):
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id_producto, sku, nombre, stock_actual FROM Productos WHERE id_producto = ? AND activo = 1",
                (id_producto,),
            )
            return cursor.fetchone()

    def actualizar_stock_producto(self, id_producto: int, nuevo_stock: int) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE Productos SET stock_actual = ?, fecha_actualizacion = GETDATE() WHERE id_producto = ?",
                (nuevo_stock, id_producto),
            )
            actualizado = cursor.rowcount > 0
            conn.commit()
            return actualizado

    def obtener_detalle_producto(self, id_producto: int):
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT p.id_producto, p.sku, p.nombre, p.marca, c.nombre AS categoria,
                       p.precio_unitario, p.precio_promocion, p.stock_actual,
                       p.descripcion_tecnica, p.resistencia_min_lb, p.resistencia_max_lb,
                       p.peso_gr, p.potencia, p.accion, p.entorno_recomendado
                FROM Productos p
                INNER JOIN Categorias c ON p.id_categoria = c.id_categoria
                WHERE p.id_producto = ? AND p.activo = 1
                """,
                (id_producto,),
            )
            return cursor.fetchone()

    def obtener_imagenes_producto(self, id_producto: int) -> list:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT url_imagen, es_principal, resolucion
                FROM Imagenes_Producto
                WHERE id_producto = ?
                ORDER BY es_principal DESC, id_imagen ASC
                """,
                (id_producto,),
            )
            return cursor.fetchall()

    def obtener_precios_producto(self, id_producto: int):
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id_producto, sku, nombre, precio_unitario, precio_promocion
                FROM Productos
                WHERE id_producto = ? AND activo = 1
                """,
                (id_producto,),
            )
            return cursor.fetchone()

    def actualizar_precio_producto(self, id_producto: int, precio_unitario: float, precio_promocion: float | None) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE Productos
                SET precio_unitario = ?, precio_promocion = ?, fecha_actualizacion = GETDATE()
                WHERE id_producto = ?
                """,
                (precio_unitario, precio_promocion, id_producto),
            )
            actualizado = cursor.rowcount > 0
            conn.commit()
            return actualizado
