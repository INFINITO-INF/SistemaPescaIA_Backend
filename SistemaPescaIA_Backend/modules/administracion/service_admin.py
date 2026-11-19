from modules.administracion.repository import AdministracionRepository

class AdministracionService:
    """Módulo 5: Control operativo, autenticación de administrador y modo Mantenimiento (US017)."""

    def __init__(self, repo: AdministracionRepository = None):
        self.repo = repo or AdministracionRepository()

    def obtener_estado_mantenimiento(self) -> dict:
        config = self.repo.obtener_configuracion_kiosco()
        return {
            "modo_mantenimiento": config["modo_mantenimiento"],
            "mensaje_mantenimiento": config["mensaje_mantenimiento"],
        }

    @staticmethod
    def validar_pin(pin_ingresado: str, pin_esperado: str) -> bool:
        """TA10-02: Valida que la credencial/PIN del administrador coincida."""
        return bool(pin_ingresado) and str(pin_ingresado).strip() == str(pin_esperado).strip()

    def autenticar_administrador(self, pin: str) -> dict:
        """Valida el PIN de acceso al panel de gestión contra Configuracion_Kiosco en SQL Server."""
        config = self.repo.obtener_configuracion_kiosco()
        if not self.validar_pin(pin, config["pin_administrador_hash"]):
            return {
                "autorizado": False,
                "mensaje": "PIN incorrecto. Acceso denegado al panel de administración.",
            }
        return {
            "autorizado": True,
            "mensaje": "Credencial verificada. Acceso concedido.",
        }

    def cambiar_estado_mantenimiento(self, activar: bool, pin: str) -> dict:
        """TA10-01 y TA10-02 / CA040 y CA041: Activa o desactiva mantenimiento validando PIN."""
        config = self.repo.obtener_configuracion_kiosco()
        if not self.validar_pin(pin, config["pin_administrador_hash"]):
            return {
                "autorizado": False,
                "modo_mantenimiento": config["modo_mantenimiento"],
                "mensaje": "PIN de administrador inválido. Operación rechazada.",
            }

        self.repo.actualizar_modo_mantenimiento(activar)
        return {
            "autorizado": True,
            "modo_mantenimiento": bool(activar),
            "mensaje_mantenimiento": config["mensaje_mantenimiento"],
            "mensaje": (
                "Modo Fuera de Servicio / Mantenimiento activado correctamente."
                if activar
                else "Servicio público restablecido en estado limpio."
            ),
        }