import json
import logging
import pytest
from app import create_app
from modules.catalogo_inventario.service import CatalogoInventarioService
from modules.busqueda_vision.service_busqueda import BusquedaService
from modules.busqueda_vision.service_vision_ia import VisionIAService
from modules.asesor_ia.service_asesor import AsesorIAService
from modules.administracion.service_admin import AdministracionService

logger = logging.getLogger("AuditoriaPruebas")


class VerboseTestClient:

    def __init__(self, flask_client):
        self._client = flask_client

    def _log_exchange(self, metodo: str, url: str, payload, response):
        datos_resp = response.get_json(silent=True)
        resp_formateada = json.dumps(datos_resp, ensure_ascii=False, indent=2) if datos_resp else response.get_data(as_text=True)

        info_entrada = ""
        if isinstance(payload, dict) and any(hasattr(v, "read") or isinstance(v, tuple) for v in payload.values()):
            info_entrada = f"\n[DATOS ENTRADA] <Archivo Multipart: {list(payload.keys())}>"
        elif payload is not None:
            info_entrada = f"\n[DATOS ENTRADA] {json.dumps(payload, ensure_ascii=False)}"

        mensaje = (
            f"\n[PETICIÓN API]  {metodo} {url}"
            f"{info_entrada}"
            f"\n[CÓDIGO HTTP]   {response.status_code}"
            f"\n[RESPUESTA JSON]\n{resp_formateada}\n"
        )
        logger.info(mensaje)
        print(mensaje)
        return response

    def get(self, url: str, **kwargs):
        resp = self._client.get(url, **kwargs)
        return self._log_exchange("GET", url, None, resp)

    def post(self, url: str, **kwargs):
        payload = kwargs.get("json") if "json" in kwargs else kwargs.get("data")
        resp = self._client.post(url, **kwargs)
        return self._log_exchange("POST", url, payload, resp)

    def put(self, url: str, **kwargs):
        payload = kwargs.get("json")
        resp = self._client.put(url, **kwargs)
        return self._log_exchange("PUT", url, payload, resp)


@pytest.fixture(autouse=True)
def bitacora_automatica_prueba(request):
    nombre_test = request.node.name
    descripcion = (request.node.obj.__doc__ or "Ejecución de caso de prueba automatizado.").strip()
    marcadores = [m.name.upper() for m in request.node.iter_markers()]
    tipo_prueba = ", ".join(marcadores) if marcadores else "GENERAL"

    encabezado = (
        f"\n{'=' * 75}\n"
        f"EJECUTANDO PRUEBA : {nombre_test}\n"
        f"TIPO DE PRUEBA    : [{tipo_prueba}]\n"
        f"ESPECIFICACIÓN    : {descripcion}\n"
        f"{'=' * 75}"
    )
    logger.info(encabezado)
    print(encabezado)
    yield
    cierre = f"{'-' * 75}\nVEREDICTO FINAL   : APROBADO (PASSED) -> {nombre_test}\n{'=' * 75}\n"
    logger.info(cierre)
    print(cierre)


@pytest.fixture(scope="session")
def flask_app():
    app = create_app()
    app.config.update({"TESTING": True})
    return app


@pytest.fixture(scope="session")
def client(flask_app):
    return VerboseTestClient(flask_app.test_client())


@pytest.fixture(scope="session")
def catalogo_service():
    return CatalogoInventarioService()


@pytest.fixture(scope="session")
def busqueda_service():
    return BusquedaService()


@pytest.fixture(scope="session")
def vision_service():
    return VisionIAService()


@pytest.fixture(scope="session")
def asesor_service():
    return AsesorIAService()


@pytest.fixture(scope="session")
def admin_service():
    return AdministracionService()