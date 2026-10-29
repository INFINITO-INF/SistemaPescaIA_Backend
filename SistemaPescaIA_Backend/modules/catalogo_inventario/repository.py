from config.database import DatabaseConnection

class CatalogoRepository:
    """Capa de acceso a datos en SQL Server para catálogo, etiquetas, imágenes por grupo y cupones."""

    def __init__(self, db: DatabaseConnection = None):
        self.db = db or DatabaseConnection()

    def obtener_todos_los_productos_auditoria(self) -> list[dict]:
        """Retorna todos los productos con su stock, precios, cupón activo, marca y categoría."""
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT p.id_producto, p.sku, p.nombre, p.marca, p.id_categoria,
                       c.nombre AS categoria,
                       p.precio_unitario, p.precio_promocion, p.stock_actual,
                       p.id_cupon_aplicado,
                       cp.codigo_cupon, cp.nombre_cupon, cp.tipo_descuento, cp.valor_descuento
                FROM Productos p
                INNER JOIN Categorias c ON p.id_categoria = c.id_categoria
                LEFT JOIN Cupones_Descuento cp ON p.id_cupon_aplicado = cp.id_cupon
                WHERE p.activo = 1
                ORDER BY p.marca ASC, c.nombre ASC, p.sku ASC
                """
            )
            return [
                {
                    "id_producto": r.id_producto,
                    "sku": r.sku,
                    "nombre": r.nombre,
                    "marca": r.marca,
                    "id_categoria": r.id_categoria,
                    "categoria": r.categoria,
                    "precio_unitario": float(r.precio_unitario),
                    "precio_promocion": float(r.precio_promocion) if r.precio_promocion is not None else None,
                    "precio_vigente_caja": float(r.precio_promocion if r.precio_promocion is not None else r.precio_unitario),
                    "en_promocion": r.precio_promocion is not None,
                    "stock_actual": r.stock_actual,
                    "id_cupon_aplicado": r.id_cupon_aplicado,
                    "codigo_cupon": r.codigo_cupon,
                    "nombre_cupon": r.nombre_cupon,
                }
                for r in cursor.fetchall()
            ]

    # --- Gestión de Cupones Modulares ---
    def listar_cupones(self) -> list[dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id_cupon, codigo_cupon, nombre_cupon, descripcion_accion, tipo_descuento, valor_descuento
                FROM Cupones_Descuento
                WHERE activo = 1
                ORDER BY id_cupon ASC
                """
            )
            return [
                {
                    "id_cupon": r.id_cupon,
                    "codigo_cupon": r.codigo_cupon,
                    "nombre_cupon": r.nombre_cupon,
                    "descripcion_accion": r.descripcion_accion,
                    "tipo_descuento": r.tipo_descuento,
                    "valor_descuento": float(r.valor_descuento),
                }
                for r in cursor.fetchall()
            ]

    def obtener_cupon_por_id(self, id_cupon: int):
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id_cupon, codigo_cupon, nombre_cupon, descripcion_accion, tipo_descuento, valor_descuento
                FROM Cupones_Descuento
                WHERE id_cupon = ? AND activo = 1
                """,
                (id_cupon,),
            )
            return cursor.fetchone()

    def crear_cupon(self, codigo: str, nombre: str, descripcion: str, tipo: str, valor: float) -> dict:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id_cupon FROM Cupones_Descuento WHERE UPPER(codigo_cupon) = UPPER(?)",
                (codigo,),
            )
            if cursor.fetchone():
                return {"creado": False, "mensaje": f"El código de cupón '{codigo}' ya existe."}

            cursor.execute(
                """
                INSERT INTO Cupones_Descuento (codigo_cupon, nombre_cupon, descripcion_accion, tipo_descuento, valor_descuento)
                OUTPUT INSERTED.id_cupon, INSERTED.codigo_cupon, INSERTED.nombre_cupon,
                       INSERTED.descripcion_accion, INSERTED.tipo_descuento, INSERTED.valor_descuento
                VALUES (UPPER(?), ?, ?, ?, ?)
                """,
                (codigo, nombre, descripcion, tipo, valor),
            )
            nuevo = cursor.fetchone()
            conn.commit()
            return {
                "creado": True,
                "mensaje": "Cupón creado exitosamente",
                "cupon": {
                    "id_cupon": nuevo.id_cupon,
                    "codigo_cupon": nuevo.codigo_cupon,
                    "nombre_cupon": nuevo.nombre_cupon,
                    "descripcion_accion": nuevo.descripcion_accion,
                    "tipo_descuento": nuevo.tipo_descuento,
                    "valor_descuento": float(nuevo.valor_descuento),
                },
            }

    def guardar_cupon_en_producto(self, id_producto: int, id_cupon: int | None, nuevo_precio_promo: float | None) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE Productos
                SET id_cupon_aplicado = ?, precio_promocion = ?, fecha_actualizacion = GETDATE()
                WHERE id_producto = ?
                """,
                (id_cupon, nuevo_precio_promo, id_producto),
            )
            actualizado = cursor.rowcount > 0
            conn.commit()
            return actualizado

    # --- Gestión de Etiquetas Técnicas ---
    def obtener_catalogo_etiquetas(self) -> list[dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id_etiqueta, nombre_etiqueta, tipo_etiqueta
                FROM Etiquetas_Tecnicas
                ORDER BY tipo_etiqueta ASC, nombre_etiqueta ASC
                """
            )
            return [
                {
                    "id_etiqueta": r.id_etiqueta,
                    "nombre_etiqueta": r.nombre_etiqueta,
                    "tipo_etiqueta": r.tipo_etiqueta,
                }
                for r in cursor.fetchall()
            ]

    def crear_nueva_etiqueta(self, nombre_etiqueta: str, tipo_etiqueta: str) -> dict:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id_etiqueta, nombre_etiqueta, tipo_etiqueta FROM Etiquetas_Tecnicas WHERE LOWER(nombre_etiqueta) = LOWER(?)",
                (nombre_etiqueta,),
            )
            existente = cursor.fetchone()
            if existente:
                return {
                    "creada": False,
                    "mensaje": "La etiqueta ya existe en el catálogo",
                    "etiqueta": {
                        "id_etiqueta": existente.id_etiqueta,
                        "nombre_etiqueta": existente.nombre_etiqueta,
                        "tipo_etiqueta": existente.tipo_etiqueta,
                    },
                }

            cursor.execute(
                """
                INSERT INTO Etiquetas_Tecnicas (nombre_etiqueta, tipo_etiqueta)
                OUTPUT INSERTED.id_etiqueta, INSERTED.nombre_etiqueta, INSERTED.tipo_etiqueta
                VALUES (?, ?)
                """,
                (nombre_etiqueta, tipo_etiqueta),
            )
            nueva = cursor.fetchone()
            conn.commit()
            return {
                "creada": True,
                "mensaje": "Etiqueta creada exitosamente",
                "etiqueta": {
                    "id_etiqueta": nueva.id_etiqueta,
                    "nombre_etiqueta": nueva.nombre_etiqueta,
                    "tipo_etiqueta": nueva.tipo_etiqueta,
                },
            }

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

    # --- Stock, Fichas e Imágenes por Grupo (Marca + Categoría) ---
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
                SELECT p.id_producto, p.sku, p.nombre, p.marca, p.id_categoria, c.nombre AS categoria,
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

    def obtener_imagenes_por_grupo_y_producto(self, id_producto: int, marca: str, id_categoria: int) -> list[dict]:
        """Obtiene primero la imagen grupal (Marca + Categoría) y luego cualquier foto extra del SKU."""
        galeria = []
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT url_imagen, resolucion
                FROM Imagenes_Grupo_Catalogo
                WHERE marca = ? AND id_categoria = ?
                """,
                (marca, id_categoria),
            )
            img_grupo = cursor.fetchone()
            if img_grupo:
                galeria.append({
                    "url_imagen": img_grupo.url_imagen,
                    "es_principal": True,
                    "resolucion": img_grupo.resolucion,
                    "origen": f"Grupo {marca}",
                    "es_default": False,
                })

            cursor.execute(
                """
                SELECT url_imagen, es_principal, resolucion
                FROM Imagenes_Producto
                WHERE id_producto = ?
                ORDER BY es_principal DESC, id_imagen ASC
                """,
                (id_producto,),
            )
            for row in cursor.fetchall():
                if not any(g["url_imagen"] == row.url_imagen for g in galeria):
                    galeria.append({
                        "url_imagen": row.url_imagen,
                        "es_principal": bool(row.es_principal) if not galeria else False,
                        "resolucion": row.resolucion,
                        "origen": "SKU Individual",
                        "es_default": False,
                    })
        return galeria

    def obtener_precios_producto(self, id_producto: int):
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id_producto, sku, nombre, precio_unitario, precio_promocion, id_cupon_aplicado
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