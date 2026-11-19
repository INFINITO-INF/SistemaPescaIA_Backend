import time
from modules.asesor_ia.repository import AsesorIARepository

class AsesorIAService:

    GUIAS_BASE_POR_CATEGORIA = {
        "Cañas de Pesca": "Elemento principal de lanzamiento y control de pelea con el pez; su potencia y acción definen el peso de señuelo y línea que soporta.",
        "Carretes": "Mecanismo de bobinado y freno que regula la salida de línea durante la captura; debe balancearse con la potencia de la caña.",
        "Señuelos": "Imitación artificial diseñada para atraer depredadores mediante movimiento, vibración y color en la columna de agua.",
        "Señuelos Agua Dulce": "Señuelo calibrado para corrientes de río y lagunas, ideal para especies de agua dulce como la trucha.",
        "Señuelos de Mar": "Señuelo resistente a la salinidad y diseñado para lances largos en playa o rompiente.",
        "Líneas y Sedales": "Conexión directa entre el carrete y el señuelo; su resistencia en libras debe estar dentro del rango de la caña.",
        "Accesorios y Anzuelos": "Componente esencial del aparejo que asegura la sujeción de la carnada o el señuelo y maximiza la clavada segura.",
    }

    def __init__(self, repo: AsesorIARepository = None):
        self.repo = repo or AsesorIARepository()

    @classmethod
    def construir_explicacion_simplificada(cls, datos: dict) -> dict:
        inicio = time.perf_counter()

        nombre = datos["nombre"]
        categoria = datos["categoria"]
        marca = datos.get("marca") or "Genérica"
        desc = datos.get("descripcion_tecnica")
        potencia = datos.get("potencia")
        accion = datos.get("accion")
        r_min = datos.get("resistencia_min_lb")
        r_max = datos.get("resistencia_max_lb")
        peso = datos.get("peso_gr")
        entorno = datos.get("entorno_recomendado")
        etiquetas = datos.get("etiquetas") or []

        tiene_datos_detallados = any([desc, potencia, accion, r_min, r_max])

        ventajas = []
        if not tiene_datos_detallados:
            guia_cat = cls.GUIAS_BASE_POR_CATEGORIA.get(
                categoria,
                f"Artículo perteneciente a la familia {categoria}, diseñado para complementar tu equipo de pesca deportiva.",
            )
            resumen = f"{nombre} ({marca}) es un insumo de la categoría {categoria}. {guia_cat}"
            ventajas.append(f"Uso práctico y versátil dentro de la categoría {categoria}.")
            if peso:
                ventajas.append(f"Peso ligero de referencia ({peso:g} g) para facilitar su manejo en el aparejo.")
            modalidad_recomendada = entorno or "Pesca recreativa general"
            nivel_detalle = "GUIA_GENERAL_CATEGORIA"
        else:
            # CA013: Resumen técnico completo y simplificado para el cliente
            partes = [f"El artículo {nombre} de la marca {marca} está clasificado dentro de {categoria}."]
            if desc:
                partes.append(desc)
            if potencia or accion:
                partes.append(
                    f"Cuenta con potencia {potencia or 'estándar'} y acción {accion or 'equilibrada'}, "
                    "lo que facilita una respuesta controlada al lanzar y clavar."
                )
            if r_min is not None and r_max is not None:
                partes.append(
                    f"Trabaja de forma óptima con líneas de entre {r_min:g} y {r_max:g} libras de resistencia."
                )
            resumen = " ".join(partes)

            if potencia:
                ventajas.append(f"Potencia {potencia}: ideal para controlar capturas acordes a su rango técnico.")
            if accion:
                ventajas.append(f"Acción {accion}: mejora la sensibilidad ante picadas y precisión en el lance.")
            if peso:
                ventajas.append(f"Peso de {peso:g} g que reduce la fatiga en jornadas prolongadas.")
            if not ventajas:
                ventajas.append("Especificaciones balanceadas para un rendimiento confiable en campo.")

            especies = [e["nombre"] for e in etiquetas if e["tipo"] == "Especie"]
            modalidades = [e["nombre"] for e in etiquetas if e["tipo"] == "Modalidad"]
            modalidad_recomendada = ", ".join(modalidades) if modalidades else (entorno or "Uso polivalente")
            if especies:
                ventajas.append(f"Recomendado especialmente para la captura de: {', '.join(especies)}.")
            nivel_detalle = "EXPLICACION_TECNICA_COMPLETA"

        tiempo_ms = round((time.perf_counter() - inicio) * 1000, 3)

        return {
            "id_producto": datos["id_producto"],
            "sku": datos["sku"],
            "nombre": nombre,
            "categoria": categoria,
            "nivel_detalle": nivel_detalle,
            "resumen_legible": resumen,
            "ventajas_clave": ventajas,
            "modalidad_recomendada": modalidad_recomendada,
            "entorno_sugerido": entorno or "Agua dulce y mar",
            "tiempo_generacion_ms": tiempo_ms,
        }

    def generar_explicacion_producto(self, id_producto: int) -> dict | None:
        """TA09-01 a TA09-03: Consulta BD y genera la explicación simplificada."""
        datos = self.repo.obtener_datos_tecnicos_producto(id_producto)
        if not datos:
            return None
        return self.construir_explicacion_simplificada(datos)
