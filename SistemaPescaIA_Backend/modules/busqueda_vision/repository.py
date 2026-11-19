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

    def filtrar_productos_multi_atributo(
        self,
        termino: str = None,
        id_categoria: int = None,
        marca: str = None,
        resistencia_min_lb: float = None,
        resistencia_max_lb: float = None,
        peso_max_gr: float = None,
        precio_min: float = None,
        precio_max: float = None,
        potencia: str = None,
        entorno: str = None,
    ) -> list:
        """TA07-01 / US003: Construye consulta parametrizada intersectando todos los filtros técnicos activos."""
        condiciones = ["p.activo = 1"]
        parametros = [Settings.DEFAULT_IMAGE_URL]

        if termino:
            patron = f"%{termino}%"
            condiciones.append(
                "(p.nombre LIKE ? OR p.marca LIKE ? OR p.sku LIKE ? OR et.nombre_etiqueta LIKE ?)"
            )
            parametros.extend([patron, patron, patron, patron])

        if id_categoria is not None:
            condiciones.append("(p.id_categoria = ? OR c.id_categoria_padre = ?)")
            parametros.extend([id_categoria, id_categoria])

        if marca:
            condiciones.append("p.marca = ?")
            parametros.append(marca)

        if resistencia_min_lb is not None:
            condiciones.append("p.resistencia_max_lb >= ?")
            parametros.append(resistencia_min_lb)

        if resistencia_max_lb is not None:
            condiciones.append("p.resistencia_min_lb <= ?")
            parametros.append(resistencia_max_lb)

        if peso_max_gr is not None:
            condiciones.append("p.peso_gr <= ?")
            parametros.append(peso_max_gr)

        if precio_min is not None:
            condiciones.append("COALESCE(p.precio_promocion, p.precio_unitario) >= ?")
            parametros.append(precio_min)

        if precio_max is not None:
            condiciones.append("COALESCE(p.precio_promocion, p.precio_unitario) <= ?")
            parametros.append(precio_max)

        if potencia:
            condiciones.append("p.potencia = ?")
            parametros.append(potencia)

        if entorno:
            condiciones.append("p.entorno_recomendado LIKE ?")
            parametros.append(f"%{entorno}%")

        where_sql = " AND ".join(condiciones)
        query = f"""
            SELECT DISTINCT
                p.id_producto, p.sku, p.nombre, p.marca, p.id_categoria,
                c.nombre AS categoria_nombre,
                p.precio_unitario, p.precio_promocion, p.stock_actual,
                p.resistencia_min_lb, p.resistencia_max_lb, p.peso_gr,
                p.potencia, p.entorno_recomendado,
                COALESCE(ig.url_imagen, ?) AS url_imagen_grupo
            FROM Productos p
            INNER JOIN Categorias c ON p.id_categoria = c.id_categoria
            LEFT JOIN Producto_Etiquetas pe ON p.id_producto = pe.id_producto
            LEFT JOIN Etiquetas_Tecnicas et ON pe.id_etiqueta = et.id_etiqueta
            LEFT JOIN Imagenes_Grupo_Catalogo ig ON p.marca = ig.marca AND p.id_categoria = ig.id_categoria
            WHERE {where_sql}
            ORDER BY p.nombre ASC
        """
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, parametros)
            return cursor.fetchall()

    def obtener_opciones_filtros_tecnicos(self) -> dict:
        """Retorna valores únicos disponibles en BD para poblar los filtros dinámicos."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT marca FROM Productos WHERE activo = 1 ORDER BY marca")
            marcas = [r.marca for r in cursor.fetchall()]

            cursor.execute("SELECT DISTINCT potencia FROM Productos WHERE activo = 1 AND potencia IS NOT NULL ORDER BY potencia")
            potencias = [r.potencia for r in cursor.fetchall()]

            cursor.execute("SELECT DISTINCT entorno_recomendado FROM Productos WHERE activo = 1 AND entorno_recomendado IS NOT NULL")
            entornos = [r.entorno_recomendado for r in cursor.fetchall()]

            return {"marcas": marcas, "potencias": potencias, "entornos": entornos}

    def buscar_productos_por_clase_vision(self, clase_ia: str, sku_especifico: str = None) -> list:
        """TA08-03 / US004: Consulta en BD los productos asociados a la clase detectada por el modelo visual."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            if sku_especifico:
                cursor.execute(
                    """
                    SELECT p.id_producto, p.sku, p.nombre, p.marca, p.id_categoria,
                           c.nombre AS categoria_nombre, p.precio_unitario, p.precio_promocion,
                           p.stock_actual, p.clase_ia_vision,
                           COALESCE(ig.url_imagen, ?) AS url_imagen_grupo
                    FROM Productos p
                    INNER JOIN Categorias c ON p.id_categoria = c.id_categoria
                    LEFT JOIN Imagenes_Grupo_Catalogo ig ON p.marca = ig.marca AND p.id_categoria = ig.id_categoria
                    WHERE p.activo = 1 AND p.sku = ?
                    """,
                    (Settings.DEFAULT_IMAGE_URL, sku_especifico),
                )
            else:
                cursor.execute(
                    """
                    SELECT p.id_producto, p.sku, p.nombre, p.marca, p.id_categoria,
                           c.nombre AS categoria_nombre, p.precio_unitario, p.precio_promocion,
                           p.stock_actual, p.clase_ia_vision,
                           COALESCE(ig.url_imagen, ?) AS url_imagen_grupo
                    FROM Productos p
                    INNER JOIN Categorias c ON p.id_categoria = c.id_categoria
                    LEFT JOIN Imagenes_Grupo_Catalogo ig ON p.marca = ig.marca AND p.id_categoria = ig.id_categoria
                    WHERE p.activo = 1 AND p.clase_ia_vision = ?
                    ORDER BY p.stock_actual DESC, p.nombre ASC
                    """,
                    (Settings.DEFAULT_IMAGE_URL, clase_ia),
                )
            return cursor.fetchall()

    def obtener_alternativos_disponibles_categoria(self, id_categoria: int, excluir_id_producto: int) -> list:
        """TA08-03 / CA011: Busca productos equivalentes con stock > 0 de la misma categoría."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT TOP 4 p.id_producto, p.sku, p.nombre, p.marca, p.id_categoria,
                       c.nombre AS categoria_nombre, p.precio_unitario, p.precio_promocion,
                       p.stock_actual, COALESCE(ig.url_imagen, ?) AS url_imagen_grupo
                FROM Productos p
                INNER JOIN Categorias c ON p.id_categoria = c.id_categoria
                LEFT JOIN Imagenes_Grupo_Catalogo ig ON p.marca = ig.marca AND p.id_categoria = ig.id_categoria
                WHERE p.activo = 1 AND p.id_categoria = ? AND p.id_producto <> ? AND p.stock_actual > 0
                ORDER BY p.stock_actual DESC
                """,
                (Settings.DEFAULT_IMAGE_URL, id_categoria, excluir_id_producto),
            )
            return cursor.fetchall()

    def registrar_log_vision_ia(
        self,
        clase_detectada: str,
        id_producto_detectado: int | None,
        confianza: float,
        tuvo_resultados: bool,
        tenia_stock: bool,
    ) -> None:
        """Registra la consulta visual en Logs_Actividad_IA_Busqueda para trazabilidad futura (US018/US019)."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO Logs_Actividad_IA_Busqueda
                    (tipo_evento, termino_o_clase_buscada, id_producto_detectado, confianza_ia, tuvo_resultados, tenia_stock)
                VALUES ('IMAGEN_IA', ?, ?, ?, ?, ?)
                """,
                (clase_detectada, id_producto_detectado, confianza, int(tuvo_resultados), int(tenia_stock)),
            )
            conn.commit()