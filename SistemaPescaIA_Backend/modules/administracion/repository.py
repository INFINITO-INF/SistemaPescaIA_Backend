from config.database import DatabaseConnection

class AdministracionRepository:

    def __init__(self, db: DatabaseConnection = None):
        self.db = db or DatabaseConnection()

    def obtener_configuracion_kiosco(self) -> dict:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT tiempo_inactividad_seg, tiempo_alerta_regresiva_seg,
                       modo_mantenimiento, pin_administrador_hash, mensaje_mantenimiento
                FROM Configuracion_Kiosco
                WHERE id_config = 1
                """
            )
            row = cursor.fetchone()
            if not row:
                return {
                    "tiempo_inactividad_seg": 60,
                    "tiempo_alerta_regresiva_seg": 10,
                    "modo_mantenimiento": False,
                    "pin_administrador_hash": "Nova56712",
                    "mensaje_mantenimiento": "Sistema en actualización, consulte en mostrador",
                }
            return {
                "tiempo_inactividad_seg": row.tiempo_inactividad_seg,
                "tiempo_alerta_regresiva_seg": row.tiempo_alerta_regresiva_seg,
                "modo_mantenimiento": bool(row.modo_mantenimiento),
                "pin_administrador_hash": row.pin_administrador_hash,
                "mensaje_mantenimiento": row.mensaje_mantenimiento,
            }

    def actualizar_modo_mantenimiento(self, activar: bool) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE Configuracion_Kiosco SET modo_mantenimiento = ? WHERE id_config = 1",
                (1 if activar else 0,),
            )
            actualizado = cursor.rowcount > 0
            conn.commit()
            return actualizado
