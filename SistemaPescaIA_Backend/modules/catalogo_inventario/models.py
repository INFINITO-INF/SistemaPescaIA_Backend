from dataclasses import dataclass
from typing import Optional

@dataclass
class ProductoDTO:
    id_producto: int
    sku: str
    nombre: str
    marca: str
    categoria: str
    precio_unitario: float
    precio_promocion: Optional[float]
    stock_actual: int
    descripcion_tecnica: Optional[str]
    resistencia_min_lb: Optional[float]
    resistencia_max_lb: Optional[float]
    peso_gr: Optional[float]
    potencia: Optional[str]
    accion: Optional[str]
    entorno_recomendado: Optional[str]
