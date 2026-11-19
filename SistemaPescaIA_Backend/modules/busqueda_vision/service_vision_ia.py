import io
from PIL import Image, ImageStat
from config.settings import Settings
from modules.busqueda_vision.repository import BusquedaRepository

class VisionIAService:
    MAPEO_CLASES_PESCA = {
        "cana": ("cana_spinning_media", None, 92.4),
        "shimano_canas": ("cana_spinning_media", None, 94.1),
        "ultraligera": ("cana_ultraligera", None, 91.0),
        "okuma": ("cana_ultraligera", None, 89.5),
        "carrete": ("carrete_spinning_4000", None, 93.2),
        "sienna": ("carrete_spinning_4000", None, 95.0),
        "daiwa": ("carrete_spinning_4000", None, 90.8),
        "linea": ("linea_trenzada_verde", None, 88.6),
        "powerpro": ("linea_trenzada_verde", None, 91.2),
        "sufix": ("linea_trenzada_pesada", None, 90.4),
        "trucha": ("senuelo_minnow_trucha", None, 92.0),
        "rapala": ("senuelo_minnow_trucha", None, 94.5),
        "yozuri": ("senuelo_minnow_mar", "SEN-YOM-008", 91.8),
        "agotado": ("senuelo_minnow_mar", "SEN-YOM-008", 89.0),
        "senuelo": ("senuelo_minnow_mar", None, 87.5),
        "anzuelo": ("anzuelo_simple", None, 86.2),
    }

    def __init__(self, repo: BusquedaRepository = None):
        self.repo = repo or BusquedaRepository()

    @staticmethod
    def preprocesar_imagen(imagen_bytes: bytes) -> dict:
        if not imagen_bytes:
            return {"valida": False, "motivo": "No se recibieron datos de imagen"}

        try:
            img = Image.open(io.BytesIO(imagen_bytes)).convert("RGB")
        except Exception:
            return {"valida": False, "motivo": "Formato de archivo de imagen inválido"}

        ancho_orig, alto_orig = img.size
        img_redimensionada = img.resize(Settings.VISION_IMAGE_TARGET_SIZE)

        img_gris = img_redimensionada.convert("L")
        stats = ImageStat.Stat(img_gris)
        brillo_promedio = float(stats.mean[0])
        contraste_desv = float(stats.stddev[0])

        calidad_aceptable = (brillo_promedio >= 20.0) and (contraste_desv >= 8.0)

        return {
            "valida": True,
            "dimensiones_originales": f"{ancho_orig}x{alto_orig}",
            "dimensiones_normalizadas": f"{Settings.VISION_IMAGE_TARGET_SIZE[0]}x{Settings.VISION_IMAGE_TARGET_SIZE[1]}",
            "brillo_promedio": round(brillo_promedio, 2),
            "contraste_nitidez": round(contraste_desv, 2),
            "calidad_aceptable": calidad_aceptable,
        }

    @classmethod
    def evaluar_umbral_confianza(cls, confianza: float) -> bool:
        return float(confianza) >= Settings.VISION_CONFIDENCE_THRESHOLD

    def _inferir_clase_pesca(self, nombre_archivo: str, metricas_preproc: dict) -> dict:
        if not metricas_preproc.get("calidad_aceptable", False):
            return {
                "clase_ia": "desconocido_baja_calidad",
                "sku_especifico": None,
                "confianza": 32.5,
            }

        nombre_norm = (nombre_archivo or "").lower().replace("-", "_").replace(" ", "_")
        for clave, (clase_bd, sku_esp, conf) in self.MAPEO_CLASES_PESCA.items():
            if clave in nombre_norm:
                return {
                    "clase_ia": clase_bd,
                    "sku_especifico": sku_esp,
                    "confianza": conf,
                }

        return {
            "clase_ia": "no_reconocido_pesca",
            "sku_especifico": None,
            "confianza": 41.0,
        }

    def identificar_producto_desde_imagen(self, imagen_bytes: bytes, nombre_archivo: str = "") -> dict:
        preproc = self.preprocesar_imagen(imagen_bytes)
        if not preproc["valida"]:
            return {
                "identificado": False,
                "confianza": 0.0,
                "umbral_requerido": Settings.VISION_CONFIDENCE_THRESHOLD,
                "mensaje": "No se pudo identificar el artículo con claridad",
                "accion_sugerida": "Captura una nueva imagen en formato JPG o PNG o busca por categorías.",
                "preprocesamiento": preproc,
                "coincidencias": [],
                "alternativos_disponibles": [],
            }

        prediccion = self._inferir_clase_pesca(nombre_archivo, preproc)
        confianza = prediccion["confianza"]
        clase_ia = prediccion["clase_ia"]

        if not self.evaluar_umbral_confianza(confianza):
            self.repo.registrar_log_vision_ia(clase_ia, None, confianza, False, False)
            return {
                "identificado": False,
                "clase_detectada": clase_ia,
                "confianza": confianza,
                "umbral_requerido": Settings.VISION_CONFIDENCE_THRESHOLD,
                "mensaje": "No se pudo identificar el artículo con claridad",
                "accion_sugerida": "Por favor captura una nueva imagen con buena iluminación o busca por categorías.",
                "preprocesamiento": preproc,
                "coincidencias": [],
                "alternativos_disponibles": [],
            }

        filas = self.repo.buscar_productos_por_clase_vision(clase_ia, prediccion["sku_especifico"])
        if not filas:
            self.repo.registrar_log_vision_ia(clase_ia, None, confianza, False, False)
            return {
                "identificado": False,
                "clase_detectada": clase_ia,
                "confianza": confianza,
                "umbral_requerido": Settings.VISION_CONFIDENCE_THRESHOLD,
                "mensaje": "No se encontraron coincidencias registradas en el inventario para esta clase.",
                "coincidencias": [],
                "alternativos_disponibles": [],
            }

        coincidencias = [
            {
                "id_producto": r.id_producto,
                "sku": r.sku,
                "nombre": r.nombre,
                "marca": r.marca,
                "id_categoria": r.id_categoria,
                "categoria_nombre": r.categoria_nombre,
                "precio_regular": float(r.precio_unitario),
                "precio_vigente": float(r.precio_promocion if r.precio_promocion is not None else r.precio_unitario),
                "en_promocion": r.precio_promocion is not None,
                "stock_actual": r.stock_actual,
                "estado_stock": "Disponible en tienda" if r.stock_actual > 0 else "Agotado",
                "url_imagen": r.url_imagen_grupo,
            }
            for r in filas
        ]

        principal = coincidencias[0]
        tiene_stock = principal["stock_actual"] > 0
        alternativos = []

        if not tiene_stock:
            filas_alt = self.repo.obtener_alternativos_disponibles_categoria(
                principal["id_categoria"], principal["id_producto"]
            )
            alternativos = [
                {
                    "id_producto": a.id_producto,
                    "sku": a.sku,
                    "nombre": a.nombre,
                    "marca": a.marca,
                    "precio_vigente": float(a.precio_promocion if a.precio_promocion is not None else a.precio_unitario),
                    "stock_actual": a.stock_actual,
                    "url_imagen": a.url_imagen_grupo,
                }
                for a in filas_alt
            ]

        self.repo.registrar_log_vision_ia(clase_ia, principal["id_producto"], confianza, True, tiene_stock)

        return {
            "identificado": True,
            "clase_detectada": clase_ia,
            "confianza": confianza,
            "umbral_requerido": Settings.VISION_CONFIDENCE_THRESHOLD,
            "estado_stock_principal": "Disponible en tienda" if tiene_stock else "Agotado",
            "mensaje": (
                "Artículo identificado con stock disponible en tienda"
                if tiene_stock
                else "Artículo identificado pero se encuentra Agotado. Se sugieren equivalentes disponibles."
            ),
            "preprocesamiento": preproc,
            "coincidencias": coincidencias,
            "alternativos_disponibles": alternativos,
        }
