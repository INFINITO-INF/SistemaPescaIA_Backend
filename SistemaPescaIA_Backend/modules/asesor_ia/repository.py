from config.database import DatabaseConnection

class AsesorIARepository:

    def __init__(self, db: DatabaseConnection = None):
        self.db = db or DatabaseConnection()

    def obtener_datos_tecnicos_producto(self, id_producto: int) -> dict | None:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT p.id_producto, p.sku, p.nombre, p.marca,
                       c.nombre AS categoria,
                       p.descripcion_tecnica, p.resistencia_min_lb, p.resistencia_max_lb,
                       p.peso_gr, p.potencia, p.accion, p.entorno_recomendado
                FROM Productos p
                INNER JOIN Categorias c ON p.id_categoria = c.id_categoria
                WHERE p.id_producto = ? AND p.activo = 1
                """,
                (id_producto,),
            )
            prod = cursor.fetchone()
            if not prod:
                return None

            cursor.execute(
                """
                SELECT e.nombre_etiqueta, e.tipo_etiqueta
                FROM Etiquetas_Tecnicas e
                INNER JOIN Producto_Etiquetas pe ON e.id_etiqueta = pe.id_etiqueta
                WHERE pe.id_producto = ?
                """,
                (id_producto,),
            )
            etiquetas = [{"nombre": r.nombre_etiqueta, "tipo": r.tipo_etiqueta} for r in cursor.fetchall()]

            return {
                "id_producto": prod.id_producto,
                "sku": prod.sku,
                "nombre": prod.nombre,
                "marca": prod.marca,
                "categoria": prod.categoria,
                "descripcion_tecnica": prod.descripcion_tecnica,
                "resistencia_min_lb": float(prod.resistencia_min_lb) if prod.resistencia_min_lb is not None else None,
                "resistencia_max_lb": float(prod.resistencia_max_lb) if prod.resistencia_max_lb is not None else None,
                "peso_gr": float(prod.peso_gr) if prod.peso_gr is not None else None,
                "potencia": prod.potencia,
                "accion": prod.accion,
                "entorno_recomendado": prod.entorno_recomendado,
                "etiquetas": etiquetas,
            }
