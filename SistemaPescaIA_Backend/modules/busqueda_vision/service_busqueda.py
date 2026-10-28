from config.settings import Settings
from modules.busqueda_vision.repository import BusquedaRepository

class BusquedaService:
    """Lógica de negocio para Búsqueda por Texto (US001) y Categorías (US002)."""

    def __init__(self, repo: BusquedaRepository = None):
        self.repo = repo or BusquedaRepository()

    # =========================================================================
    # US001: Buscar productos ingresando texto por nombre, código o marca (CA001-CA004)
    # =========================================================================
    @staticmethod
    def validar_minimo_autocompletado(texto: str) -> bool:
        """CA002: Verifica si el texto tiene al menos 3 caracteres."""
        return len((texto or "").strip()) >= Settings.MIN_AUTOCOMPLETE_CHARS

    def buscar_por_texto(self, termino: str) -> dict:
        """CA001 y CA003: Búsqueda por coincidencia o retorno de mensaje sin resultados."""
        termino_limpio = (termino or "").strip()
        if not termino_limpio:
            return self.limpiar_campo_busqueda()

        filas = self.repo.buscar_productos_por_termino(termino_limpio)
        if not filas:
            # CA003: Mensaje exacto y sugerencia de categorías generales
            return {
                "termino_buscado": termino_limpio,
                "tuvo_resultados": False,
                "mensaje": "No se encontraron productos",
                "resultados": [],
                "categorias_sugeridas": self.listar_categorias_principales(),
            }

        resultados = [
            {
                "id_producto": r.id_producto,
                "sku": r.sku,
                "nombre": r.nombre,
                "marca": r.marca,
                "precio_vigente": float(r.precio_promocion if r.precio_promocion is not None else r.precio_unitario),
                "stock_actual": r.stock_actual,
            }
            for r in filas
        ]
        return {
            "termino_buscado": termino_limpio,
            "tuvo_resultados": True,
            "mensaje": "Búsqueda exitosa",
            "resultados": resultados,
        }

    def autocompletar(self, texto_parcial: str) -> dict:
        """CA002: Sugerencias automáticas tras digitar al menos 3 caracteres."""
        texto_limpio = (texto_parcial or "").strip()
        if not self.validar_minimo_autocompletado(texto_limpio):
            return {"Autocompletado_activo": False, "sugerencias": []}

        sugerencias = self.repo.obtener_sugerencias_autocompletado(texto_limpio)
        return {"Autocompletado_activo": True, "sugerencias": sugerencias}

    def limpiar_campo_busqueda(self) -> dict:
        """CA004: Borra el texto ingresado y restablece la vista general del catálogo."""
        return {
            "termino_buscado": "",
            "resultados": [],
            "vista_restablecida": True,
            "categorias_principales": self.listar_categorias_principales(),
        }

    # =========================================================================
    # US002: Navegar por categorías y subcategorías visuales de pesca (CA005-CA007)
    # =========================================================================
    def listar_categorias_principales(self) -> list[dict]:
        """CA005 y CA007: Obtiene las categorías principales del menú."""
        filas = self.repo.obtener_categorias_principales()
        return [
            {"id_categoria": r.id_categoria, "nombre": r.nombre, "descripcion": r.descripcion}
            for r in filas
        ]

    def seleccionar_categoria(self, id_categoria: int) -> dict:
        """CA005 y CA006: Filtra productos por categoría o subcategoría y lista subcategorías hijas."""
        productos = self.repo.obtener_productos_por_categoria(id_categoria)
        subcategorias = self.repo.obtener_subcategorias(id_categoria)

        lista_productos = [
            {
                "id_producto": p.id_producto,
                "sku": p.sku,
                "nombre": p.nombre,
                "marca": p.marca,
                "id_categoria": p.id_categoria,
                "categoria_nombre": p.categoria_nombre,
                "precio_vigente": float(p.precio_promocion if p.precio_promocion is not None else p.precio_unitario),
                "stock_actual": p.stock_actual,
            }
            for p in productos
        ]
        lista_subcategorias = [
            {"id_categoria": s.id_categoria, "nombre": s.nombre, "descripcion": s.descripcion}
            for s in subcategorias
        ]

        return {
            "id_categoria_seleccionada": id_categoria,
            "subcategorias_disponibles": lista_subcategorias,
            "productos": lista_productos,
        }

    def volver_menu_principal_categorias(self) -> dict:
        """CA007: Retorno al menú con todas las categorías principales."""
        return {
            "vista": "MENU_PRINCIPAL_CATEGORIAS",
            "id_categoria_seleccionada": None,
            "categorias_principales": self.listar_categorias_principales(),
        }
