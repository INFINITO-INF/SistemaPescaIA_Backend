from config.settings import Settings
from modules.catalogo_inventario.repository import CatalogoRepository

class CatalogoInventarioService:
    """Lógica de negocio de Catálogo, Etiquetas, Imágenes Grupales y Cupones Modulares."""

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

    def listar_resumen_productos(self) -> list[dict]:
        """Retorna la tabla completa de productos reales en inventario con su estado de precios."""
        return self.repo.obtener_todos_los_productos_auditoria()

    def obtener_arbol_marca_categoria_productos(self) -> dict:
        """
        Organiza los productos jerárquicamente por:
        Marca (ej. Shimano) -> Tipo/Categoría (ej. Cañas de Pesca) -> Lista de SKUs individuales.
        """
        productos = self.repo.obtener_todos_los_productos_auditoria()
        arbol = {}
        for p in productos:
            marca = p["marca"]
            categoria = p["categoria"]
            arbol.setdefault(marca, {}).setdefault(categoria, []).append(p)
        return arbol

    # =========================================================================
    # GESTIÓN MODULAR DE CUPONES Y REGLAS DE ELEGIBILIDAD
    # =========================================================================
    def listar_cupones_disponibles(self) -> list[dict]:
        return self.repo.listar_cupones()

    def crear_nuevo_cupon(self, codigo: str, nombre: str, descripcion: str, tipo: str, valor: float) -> dict:
        codigo_limpio = (codigo or "").strip().upper()
        nombre_limpio = (nombre or "").strip()
        desc_limpia = (descripcion or "").strip()
        tipo_limpio = (tipo or "MONTO_FIJO").strip().upper()

        if not codigo_limpio or not nombre_limpio or not desc_limpia:
            return {"creado": False, "mensaje": "Nombre, código y descripción de lo que hace el cupón son obligatorios."}
        if tipo_limpio not in ("MONTO_FIJO", "PORCENTAJE", "PROMO_2X1"):
            return {"creado": False, "mensaje": "Tipo de cupón no válido."}
        if float(valor) < 0:
            return {"creado": False, "mensaje": "El valor del descuento no puede ser negativo."}

        return self.repo.crear_cupon(codigo_limpio, nombre_limpio, desc_limpia, tipo_limpio, float(valor))

    @staticmethod
    def evaluar_elegibilidad_cupon(precio_unitario: float, tipo_descuento: str, valor_descuento: float) -> dict:
        """
        Regla de negocio modular (100% Unit-Testable):
        - Si es PROMO_2X1: Permite que el producto llegue a S/ 0.00 (ej. producto de S/ 100 pasa a S/ 0.00).
        - Si es MONTO_FIJO: El descuento NO puede ser mayor ni igual al precio regular del producto
          (ej. un cupón de S/ 100 solo aplica a productos > S/ 100, es decir de S/ 101 o más;
           productos de S/ 100 o menos quedan bloqueados en gris).
        - Si es PORCENTAJE: Permite hasta 99% en descuento normal, o 100% solo si es modalidad 2x1.
        """
        precio = float(precio_unitario)
        valor = float(valor_descuento)

        if tipo_descuento == "PROMO_2X1":
            return {
                "elegible": True,
                "nuevo_precio_promocion": 0.00,
                "motivo": "Promoción 2x1 aplicada (unidad bonificada a S/ 0.00)",
            }

        if tipo_descuento == "MONTO_FIJO":
            if precio <= valor:
                return {
                    "elegible": False,
                    "nuevo_precio_promocion": None,
                    "motivo": (
                        f"Bloqueado: El producto cuesta S/ {precio:.2f} y el cupón descuenta S/ {valor:.2f}. "
                        f"Requiere un precio mayor a S/ {valor:.2f}."
                    ),
                }
            return {
                "elegible": True,
                "nuevo_precio_promocion": round(precio - valor, 2),
                "motivo": "Cupón de monto fijo aplicable",
            }

        if tipo_descuento == "PORCENTAJE":
            if valor <= 0 or valor >= 100:
                return {
                    "elegible": False,
                    "nuevo_precio_promocion": None,
                    "motivo": "El porcentaje debe ser menor al 100% (para llegar a S/ 0.00 use PROMO_2X1).",
                }
            nuevo = round(precio * (1.0 - (valor / 100.0)), 2)
            return {
                "elegible": True,
                "nuevo_precio_promocion": nuevo,
                "motivo": f"Descuento del {valor:.0f}% aplicable",
            }

        return {"elegible": False, "nuevo_precio_promocion": None, "motivo": "Tipo de cupón desconocido"}

    def aplicar_cupon_a_producto(self, id_producto: int, id_cupon: int | None) -> dict:
        """Aplica o remueve un cupón sobre un SKU individual validando las reglas de negocio."""
        prod = self.repo.obtener_precios_producto(id_producto)
        if not prod:
            return {"aplicado": False, "mensaje": "Producto no encontrado"}

        # Si id_cupon es None o 0, removemos el cupón y restauramos su precio regular
        if not id_cupon:
            self.repo.guardar_cupon_en_producto(id_producto, None, None)
            return {
                "aplicado": True,
                "id_producto": id_producto,
                "sku": prod.sku,
                "precio_regular": float(prod.precio_unitario),
                "precio_promocion": None,
                "mensaje": "Cupón removido; producto restaurado a su precio regular.",
            }

        cupon = self.repo.obtener_cupon_por_id(id_cupon)
        if not cupon:
            return {"aplicado": False, "mensaje": "El cupón seleccionado no existe"}

        evaluacion = self.evaluar_elegibilidad_cupon(
            float(prod.precio_unitario), cupon.tipo_descuento, float(cupon.valor_descuento)
        )
        if not evaluacion["elegible"]:
            return {
                "aplicado": False,
                "id_producto": id_producto,
                "sku": prod.sku,
                "mensaje": evaluacion["motivo"],
            }

        nuevo_precio = evaluacion["nuevo_precio_promocion"]
        self.repo.guardar_cupon_en_producto(id_producto, cupon.id_cupon, nuevo_precio)
        return {
            "aplicado": True,
            "id_producto": id_producto,
            "sku": prod.sku,
            "codigo_cupon": cupon.codigo_cupon,
            "precio_regular": float(prod.precio_unitario),
            "precio_promocion": nuevo_precio,
            "mensaje": f"Cupón {cupon.codigo_cupon} aplicado a {prod.sku}. Nuevo precio: S/ {nuevo_precio:.2f}",
        }

    # =========================================================================
    # US009: Clasificar y etiquetar productos (CA021-CA023)
    # =========================================================================
    def listar_todas_las_etiquetas(self) -> list[dict]:
        return self.repo.obtener_catalogo_etiquetas()

    def crear_etiqueta_tecnica(self, nombre_etiqueta: str, tipo_etiqueta: str) -> dict:
        nombre = (nombre_etiqueta or "").strip()
        tipo = (tipo_etiqueta or "General").strip()
        if not nombre:
            return {"creada": False, "mensaje": "El nombre de la etiqueta es obligatorio"}
        return self.repo.crear_nueva_etiqueta(nombre, tipo)

    @classmethod
    def sugerir_etiquetas_ia(cls, descripcion_tecnica: str) -> list[dict]:
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
    # US010: Disponibilidad de inventario en tiempo real (CA024-CA026)
    # =========================================================================
    @staticmethod
    def evaluar_regla_stock(stock_actual: int) -> dict:
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
    # US011: Ficha técnica detallada e imágenes por Grupo (Marca + Categoría)
    # =========================================================================
    def obtener_ficha_tecnica_y_galeria(self, id_producto: int) -> dict | None:
        prod = self.repo.obtener_detalle_producto(id_producto)
        if not prod:
            return None

        galeria = self.repo.obtener_imagenes_por_grupo_y_producto(
            prod.id_producto, prod.marca, prod.id_categoria
        )
        if not galeria:
            # CA028: Cuando ni el grupo ni el producto tienen imagen (ej. Producto 10 Mustad)
            galeria = [
                {
                    "url_imagen": Settings.DEFAULT_IMAGE_URL,
                    "es_principal": True,
                    "resolucion": "1920x1080",
                    "leyenda": "Imagen referencial no disponible",
                    "origen": "Por Defecto",
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
            "id_categoria": prod.id_categoria,
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
    # US012: Sincronización de precios con BD central (CA029-CA030)
    # =========================================================================
    @staticmethod
    def calcular_precio_vigente(precio_unitario: float, precio_promocion: float | None) -> dict:
        en_promo = precio_promocion is not None and precio_promocion < precio_unitario
        precio_final = float(precio_promocion) if en_promo else float(precio_unitario)
        return {
            "precio_regular": float(precio_unitario),
            "precio_promocion": float(precio_promocion) if en_promo else None,
            "precio_vigente_caja": precio_final,
            "en_promocion": en_promo,
        }

    def consultar_precio_sincronizado(self, id_producto: int) -> dict | None:
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
            actualizado = round(precio_en_sesion, 2) != round(precio_real_caja, 2)
            if actualizado:
                hubo_ajustes = True

            subtotal_linea = round(precio_real_caja * cantidad, 2)
            subtotal_sincronizado = round(subtotal_sincronizado + subtotal_linea, 2)

            items_verificados.append({
                "id_producto": id_prod,
                "sku": datos_bd["sku"],
                "nombre": datos_bd["nombre"],
                "cantidad": cantidad,
                "precio_anterior": precio_en_sesion,
                "precio_regular_bd": datos_bd["precio_regular"],
                "en_promocion": datos_bd["en_promocion"],
                "precio_sincronizado_caja": precio_real_caja,
                "subtotal_linea": subtotal_linea,
                "fue_ajustado": actualizado,
            })

        return {
            "integridad_100_caja": True,
            "hubo_actualizacion_precios": hubo_ajustes,
            "total_sincronizado": subtotal_sincronizado,
            "items": items_verificados,
        }