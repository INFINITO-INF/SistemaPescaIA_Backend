from flask import Blueprint, jsonify, request
from modules.catalogo_inventario.service import CatalogoInventarioService

catalogo_bp = Blueprint("catalogo_inventario", __name__)
service = CatalogoInventarioService()

@catalogo_bp.route("/productos", methods=["GET"])
def listar_productos():
    """Retorna todos los productos reales del inventario y el árbol jerárquico Marca -> Tipo -> SKU."""
    return jsonify({
        "productos": service.listar_resumen_productos(),
        "arbol_marcas": service.obtener_arbol_marca_categoria_productos(),
    }), 200

@catalogo_bp.route("/cupones", methods=["GET"])
def listar_cupones():
    return jsonify({"cupones": service.listar_cupones_disponibles()}), 200

@catalogo_bp.route("/cupones", methods=["POST"])
def crear_cupon():
    data = request.get_json(silent=True) or {}
    res = service.crear_nuevo_cupon(
        codigo=data.get("codigo_cupon", ""),
        nombre=data.get("nombre_cupon", ""),
        descripcion=data.get("descripcion_accion", ""),
        tipo=data.get("tipo_descuento", "MONTO_FIJO"),
        valor=float(data.get("valor_descuento", 0)),
    )
    return jsonify(res), (201 if res.get("creado") else 400)

@catalogo_bp.route("/productos/<int:id_producto>/cupon", methods=["PUT"])
def aplicar_cupon_producto(id_producto: int):
    data = request.get_json(silent=True) or {}
    id_cupon = data.get("id_cupon")
    res = service.aplicar_cupon_a_producto(id_producto, int(id_cupon) if id_cupon else None)
    return jsonify(res), (200 if res.get("aplicado") else 400)

@catalogo_bp.route("/etiquetas", methods=["GET"])
def listar_etiquetas():
    return jsonify({"etiquetas": service.listar_todas_las_etiquetas()}), 200

@catalogo_bp.route("/etiquetas", methods=["POST"])
def crear_etiqueta():
    data = request.get_json(silent=True) or {}
    nombre = data.get("nombre_etiqueta", "")
    tipo = data.get("tipo_etiqueta", "General")
    res = service.crear_etiqueta_tecnica(nombre, tipo)
    status = 201 if res.get("creada") else (200 if res.get("etiqueta") else 400)
    return jsonify(res), status

@catalogo_bp.route("/etiquetas/sugerir", methods=["POST"])
def sugerir_etiquetas():
    data = request.get_json(silent=True) or {}
    descripcion = data.get("descripcion_tecnica", "")
    sugerencias = service.sugerir_etiquetas_ia(descripcion)
    return jsonify({"sugerencias": sugerencias}), 200

@catalogo_bp.route("/productos/<int:id_producto>/etiquetas", methods=["POST"])
def asignar_etiqueta(id_producto: int):
    data = request.get_json(silent=True) or {}
    id_etiqueta = data.get("id_etiqueta")
    if not id_etiqueta:
        return jsonify({"error": "id_etiqueta es requerido"}), 400
    res = service.asignar_etiqueta_manual(id_producto, int(id_etiqueta))
    return jsonify(res), (200 if res["indexado"] else 404)

@catalogo_bp.route("/productos/<int:id_producto>/etiquetas", methods=["PUT"])
def actualizar_etiquetas(id_producto: int):
    data = request.get_json(silent=True) or {}
    ids_etiquetas = data.get("ids_etiquetas", [])
    res = service.actualizar_etiquetas_producto(id_producto, ids_etiquetas)
    return jsonify(res), (200 if res["actualizado"] else 404)

@catalogo_bp.route("/productos/<int:id_producto>/stock", methods=["GET"])
def consultar_stock(id_producto: int):
    res = service.consultar_disponibilidad_tiempo_real(id_producto)
    if not res:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify(res), 200

@catalogo_bp.route("/productos/<int:id_producto>/ficha", methods=["GET"])
def obtener_ficha(id_producto: int):
    res = service.obtener_ficha_tecnica_y_galeria(id_producto)
    if not res:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify(res), 200

@catalogo_bp.route("/productos/<int:id_producto>/precio", methods=["GET"])
def consultar_precio(id_producto: int):
    res = service.consultar_precio_sincronizado(id_producto)
    if not res:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify(res), 200

@catalogo_bp.route("/precios/verificar-lista", methods=["POST"])
def verificar_precios_lista():
    data = request.get_json(silent=True) or {}
    items = data.get("items", [])
    res = service.verificar_integridad_precios_lista(items)
    return jsonify(res), 200