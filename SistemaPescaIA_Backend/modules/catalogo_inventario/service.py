from config.settings import Settings
from modules.catalogo_inventario.repository import CatalogoRepository

class CatalogoInventarioService:
    """Lógica de negocio de Catálogo e Inventario (US009, US010, US011, US012)."""

    REGLAS_ETIQUETADO_IA = {
        "trucha": {"id_etiqueta": 1, "nombre_etiqueta": "Trucha", "tipo_etiqueta": "Especie"},
        "corvina": {"id_etiqueta": 2, "nombre_etiqueta": "Corvina", "tipo_etiqueta": "Especie"},
        "lenguado": {"id_etiqueta": 3, "nombre_etiqueta": "Lenguado", "tipo_etiqueta": "Especie"},
        "spinning": {"id_etiqueta": 4, "nombre_etiqueta": "Spinning", "tipo_etiqueta": "Modalidad"},
        "surfcasting": {"id_etiqueta": 5, "nombre_etiqueta": "Surfcasting", "tipo_etiqueta": "Modalidad"},
        "río": {"id_etiqueta": 6, "nombre_etiqueta": "Agua Dulce / Río", "tipo_etiqueta": "Entorno"},
        "laguna": {"id_etiqueta": 6, "nombre_etiqueta": "Agua Dulce / Río", "tipo_etiqueta": "Entorno"},
        "playa": {"id_etiqueta": 7, "nombre_etiqueta": "Mar / Orilla", "tipo_etiqueta": "Entorno"},
        "orilla": {"id_etiqueta": 7, "nombre_etiqueta": "Mar / Orilla", "tipo_etiqueta": "Entorno"},
    }

    def __init__(self, repo: CatalogoRepository = None):
        self.repo = repo or CatalogoRepository()

    # =========================================================================
    # US009: Clasificar y etiquetar productos por categorías y atributos (CA021-CA023)
    # =========================================================================
    @classmethod
    def sugerir_etiquetas_ia(cls, descripcion_tecnica: str) -> list[dict]:
        """CA022: Sugiere automáticamente etiquetas técnicas analizando el texto."""
        if not descripcion_tecnica or not descripcion_tecnica.strip():
            return []
        texto = descripcion_tecnica.lower()
        sugeridas = []
        ids_vistos = set()
        for token, data_etiqueta in cls.REGLAS_ETIQUETADO_IA.items():
            if token in texto and data_etiqueta["id_etiqueta"] not in ids_vistos:
                sugeridas.append(data_etiqueta)
                ids_vistos.add(data_etiqueta["id_etiqueta"])
        return sugeridas

    def asignar_etiqueta_manual(self, id_producto: int, id_etiqueta: int) -> dict:
        """CA021: Asigna e indexa una etiqueta técnica en la BD."""
        exito = self.repo.vincular_etiqueta_producto(id_producto, id_etiqueta)
        if not exito:
            return {"indexado": False, "mensaje": "Producto o etiqueta no válidos"}
        etiquetas_actuales = self.repo.obtener_etiquetas_por_producto(id_producto)
        return {
            "indexado": True,
            "id_producto": id_producto,
            "etiquetas_indexadas": etiquetas_actuales,
        }

    def actualizar_etiquetas_producto(self, id_producto: int, ids_etiquetas: list[int]) -> dict:
        """CA023: Actualiza referencias de etiquetas para el recomendador de IA sin reiniciar."""
        exito = self.repo.reemplazar_etiquetas_producto(id_producto, ids_etiquetas)
        if not exito:
            return {"actualizado": False, "mensaje": "Producto no encontrado"}
        return {
            "actualizado": True,
            "indice_ia_sincronizado": True,
            "id_producto": id_producto,
            "etiquetas_vigentes": self.repo.obtener_etiquetas_por_producto(id_producto),
        }

    # =========================================================================
    # US010: Consultar disponibilidad en inventario en tiempo real (CA024-CA026)
    # =========================================================================
    @staticmethod
    def evaluar_regla_stock(stock_actual: int) -> dict:
        """CA024 y CA025: Evalúa el estado de inventario y bloqueo de pedido."""
        if stock_actual > 0:
            return {
                "stock_actual": stock_actual,
                "leyenda": "Disponible en tienda",
                "indicador_color": "verde",
                "boton_agregar_habilitado": True,
            }
        return {
            "stock_actual": 0,
            "leyenda": "Agotado",
            "indicador_color": "rojo",
            "boton_agregar_habilitado": False,
        }

    def consultar_disponibilidad_tiempo_real(self, id_producto: int) -> dict | None:
        """CA024, CA025 y CA026: Consulta stock en tiempo real directamente de la BD."""
        fila = self.repo.obtener_stock_producto(id_producto)
        if not fila:
            return None
        estado = self.evaluar_regla_stock(fila.stock_actual)
        return {
            "id_producto": fila.id_producto,
            "sku": fila.sku,
            "nombre": fila.nombre,
            **estado,
        }

    # =========================================================================
    # US011: Visualizar ficha técnica detallada y galería de imágenes (CA027-CA028)
    # =========================================================================
    def obtener_ficha_tecnica_y_galeria(self, id_producto: int) -> dict | None:
        """CA027 y CA028: Renderiza datos técnicos e imágenes o asigna imagen por defecto."""
        prod = self.repo.obtener_detalle_producto(id_producto)
        if not prod:
            return None

        filas_img = self.repo.obtener_imagenes_producto(id_producto)
        if filas_img:
            galeria = [
                {
                    "url_imagen": img.url_imagen,
                    "es_principal": bool(img.es_principal),
                    "resolucion": img.resolucion,
                    "es_default": False,
                }
                for img in filas_img
            ]
        else:
            # CA028: Imagen genérica estandarizada cuando no hay fotos en BD
            galeria = [
                {
                    "url_imagen": Settings.DEFAULT_IMAGE_URL,
                    "es_principal": True,
                    "resolucion": "1920x1080",
                    "leyenda": "Imagen referencial no disponible",
                    "es_default": True,
                }
            ]

        precio_vigente = (
            float(prod.precio_promocion)
            if prod.precio_promocion is not None
            else float(prod.precio_unitario)
        )

        return {
            "id_producto": prod.id_producto,
            "sku": prod.sku,
            "nombre": prod.nombre,
            "marca": prod.marca,
            "categoria": prod.categoria,
            "precio_unitario": float(prod.precio_unitario),
            "precio_vigente": precio_vigente,
            "descripcion_tecnica": prod.descripcion_tecnica or "Especificaciones estándar de categoría",
            "especificaciones": {
                "resistencia_min_lb": float(prod.resistencia_min_lb) if prod.resistencia_min_lb is not None else None,
                "resistencia_max_lb": float(prod.resistencia_max_lb) if prod.resistencia_max_lb is not None else None,
                "peso_gr": float(prod.peso_gr) if prod.peso_gr is not None else None,
                "potencia": prod.potencia,
                "accion": prod.accion,
                "entorno_recomendado": prod.entorno_recomendado,
            },
            "inventario": self.evaluar_regla_stock(prod.stock_actual),
            "galeria_imagenes": galeria,
            "etiquetas": self.repo.obtener_etiquetas_por_producto(id_producto),
        }

    # =========================================================================
    # US012: Sincronizar precios y estados de catálogo con BD central (CA029-CA030)
    # =========================================================================
    @staticmethod
    def calcular_precio_vigente(precio_unitario: float, precio_promocion: float | None) -> dict:
        """Lógica pura para determinar precio de cobro en caja."""
        en_promo = precio_promocion is not None and precio_promocion < precio_unitario
        precio_final = float(precio_promocion) if en_promo else float(precio_unitario)
        return {
            "precio_regular": float(precio_unitario),
            "precio_promocion": float(precio_promocion) if en_promo else None,
            "precio_vigente_caja": precio_final,
            "en_promocion": en_promo,
        }

    def consultar_precio_sincronizado(self, id_producto: int) -> dict | None:
        """CA029: Consulta precio actualizado directo de la BD sin caché."""
        fila = self.repo.obtener_precios_producto(id_producto)
        if not fila:
            return None
        info_precio = self.calcular_precio_vigente(fila.precio_unitario, fila.precio_promocion)
        return {
            "id_producto": fila.id_producto,
            "sku": fila.sku,
            "nombre": fila.nombre,
            **info_precio,
        }

    def verificar_integridad_precios_lista(self, items_lista: list[dict]) -> dict:
        """CA030: Valida los precios de una lista temporal contra la BD central antes del ticket."""
        items_verificados = []
        subtotal_sincronizado = 0.0
        hubo_ajustes = False

        for item in items_lista:
            id_prod = item["id_producto"]
            cantidad = int(item.get("cantidad", 1))
            precio_en_sesion = float(item.get("precio_capturado", 0.0))

            datos_bd = self.consultar_precio_sincronizado(id_prod)
            if not datos_bd:
                continue

            precio_real_caja = datos_bd["precio_vigente_caja"]
            if round(precio_en_sesion, 2) != round(precio_real_caja, 2):
                hubo_ajustes = True

            subtotal_linea = round(precio_real_caja * cantidad, 2)
            subtotal_sincronizado = round(subtotal_sincronizado + subtotal_linea, 2)

            items_verificados.append({
                "id_producto": id_prod,
                "sku": datos_bd["sku"],
                "cantidad": cantidad,
                "precio_anterior": precio_en_sesion,
                "precio_sincronizado_caja": precio_real_caja,
                "subtotal_linea": subtotal_linea,
            })

        return {
            "integridad_100_caja": True,
            "hubo_actualizacion_precios": hubo_ajustes,
            "total_sincronizado": subtotal_sincronizado,
            "items": items_verificados,
        }
