let todosLosProductosAuditoria = [];
let arbolMarcasCatalogo = {};
let catalogoGlobalEtiquetas = [];
let catalogoCupones = [];
let borradorEtiquetasModal = [];
let productoActualModal = null;

document.addEventListener("DOMContentLoaded", async () => {
    const pinGuardado = sessionStorage.getItem("admin_pin_sesion");
    if (pinGuardado) {
        // Validar que el PIN en sesión siga siendo válido en el Backend
        const res = await fetch("/api/v1/admin/autenticar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin: pinGuardado })
        });
        const data = await res.json();
        if (data.autorizado) {
            await desbloquearInterfazAdmin(pinGuardado);
            return;
        }
        sessionStorage.removeItem("admin_pin_sesion");
    }
    // Si no está autenticado, enfocar el campo PIN de la pantalla de bloqueo
    setTimeout(() => document.getElementById("inputPinLockScreen").focus(), 100);
});

async function desbloquearPanelAdminDesdeLockScreen() {
    const pin = document.getElementById("inputPinLockScreen").value;
    const err = document.getElementById("errorPinLockScreen");

    const res = await fetch("/api/v1/admin/autenticar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
    });
    const data = await res.json();

    if (!data.autorizado) {
        err.textContent = "⚠️ " + data.mensaje;
        return;
    }

    sessionStorage.setItem("admin_pin_sesion", pin);
    await desbloquearInterfazAdmin(pin);
}

async function desbloquearInterfazAdmin(pin) {
    document.getElementById("lockScreenAdmin").classList.add("hidden");
    document.getElementById("contenidoAdminProtegido").classList.remove("hidden");
    document.getElementById("inputPinMantenimiento").value = pin;

    await actualizarBadgeMantenimientoAdmin();
    await recargarCatalogoGlobalEtiquetas();
    await cargarDatosAuditoriaYCupones();
    await mostrarResumenEtiquetasProducto();
}

function bloquearYCerrarSesionAdmin() {
    sessionStorage.removeItem("admin_pin_sesion");
    window.location.href = "/";
}

// --- Control Operativo: Modo Mantenimiento (US017) ---
async function actualizarBadgeMantenimientoAdmin() {
    const res = await fetch("/api/v1/admin/mantenimiento");
    const data = await res.json();
    const badge = document.getElementById("badgeEstadoMantenimientoAdmin");
    if (data.modo_mantenimiento) {
        badge.className = "stock-badge stock-rojo";
        badge.textContent = "⛔ Kiosco en Mantenimiento";
    } else {
        badge.className = "stock-badge stock-verde";
        badge.textContent = "● Kiosco Operativo";
    }
}

async function cambiarModoMantenimientoUI(activar) {
    const pin = document.getElementById("inputPinMantenimiento").value || sessionStorage.getItem("admin_pin_sesion");
    const feedback = document.getElementById("feedbackMantenimiento");

    const res = await fetch("/api/v1/admin/mantenimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activar, pin })
    });
    const data = await res.json();
    feedback.style.color = data.autorizado ? "#0d9488" : "#b91c1c";
    feedback.textContent = (data.autorizado ? "✔ " : "⚠️ ") + data.mensaje;
    if (data.autorizado) await actualizarBadgeMantenimientoAdmin();
}

// --- Gestión de Etiquetas Técnicas (US009) ---
async function recargarCatalogoGlobalEtiquetas() {
    const res = await fetch("/api/v1/catalogo/etiquetas");
    const data = await res.json();
    catalogoGlobalEtiquetas = data.etiquetas || [];
}

async function sugerirEtiquetasIA() {
    const descripcion = document.getElementById("txtDescripcionIA").value.trim();
    const cont = document.getElementById("resultadoSugerenciasIA");
    if (!descripcion) {
        cont.innerHTML = `<span style="color:#b91c1c; font-size:0.85rem;">Escribe primero una descripción técnica.</span>`;
        return;
    }
    const res = await fetch("/api/v1/catalogo/etiquetas/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion_tecnica: descripcion })
    });
    const data = await res.json();
    cont.innerHTML = (data.sugerencias || []).length === 0
        ? `<span style="color:#64748b; font-size:0.85rem;">No se detectaron etiquetas predefinidas.</span>`
        : data.sugerencias.map(s => `<span class="tag-badge">✨ ${s.nombre_etiqueta} (${s.tipo_etiqueta})</span>`).join("");
}

function limpiarAsistenteIA() {
    document.getElementById("txtDescripcionIA").value = "";
    document.getElementById("resultadoSugerenciasIA").innerHTML = "";
}

async function crearEtiquetaManualUI() {
    const inputNombre = document.getElementById("inputNuevaEtiquetaNombre");
    const selectTipo = document.getElementById("selectNuevaEtiquetaTipo");
    const feedback = document.getElementById("mensajeCreacionEtiqueta");
    const nombre = inputNombre.value.trim();
    if (!nombre) {
        feedback.style.color = "#b91c1c";
        feedback.textContent = "⚠️ Ingresa un nombre.";
        return;
    }
    const res = await fetch("/api/v1/catalogo/etiquetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_etiqueta: nombre, tipo_etiqueta: selectTipo.value })
    });
    const data = await res.json();
    await recargarCatalogoGlobalEtiquetas();
    inputNombre.value = "";
    feedback.style.color = data.creada ? "#0d9488" : "#0284c7";
    feedback.textContent = `✔ ${data.mensaje}: "${data.etiqueta.nombre_etiqueta}"`;
}

async function mostrarResumenEtiquetasProducto() {
    const idProd = document.getElementById("selectProdEtiqueta").value;
    if (!idProd) return;
    const res = await fetch(`/api/v1/catalogo/productos/${idProd}/ficha`);
    const ficha = await res.json();
    productoActualModal = ficha;

    const cont = document.getElementById("vistaPreviaEtiquetasProducto");
    cont.innerHTML = (!ficha.etiquetas || ficha.etiquetas.length === 0)
        ? `<span style="color:#64748b; font-size:0.85rem;">Este producto aún no tiene etiquetas vinculadas.</span>`
        : ficha.etiquetas.map(e => `<span class="tag-badge">${e.nombre_etiqueta} <small>(${e.tipo_etiqueta})</small></span>`).join("");
}

async function abrirModalGestionEtiquetas() {
    await recargarCatalogoGlobalEtiquetas();
    await mostrarResumenEtiquetasProducto();
    if (!productoActualModal) return;

    borradorEtiquetasModal = [...(productoActualModal.etiquetas || [])];
    document.getElementById("tituloModalEtiquetas").textContent = `Etiquetas de: ${productoActualModal.nombre}`;
    document.getElementById("subtituloModalEtiquetas").textContent = `SKU: ${productoActualModal.sku} · Marca: ${productoActualModal.marca}`;
    renderizarEditorEtiquetasModal();
    document.getElementById("modalGestionEtiquetas").classList.remove("hidden");
}

function renderizarEditorEtiquetasModal() {
    const cajaChips = document.getElementById("contenedorChipsEditables");
    const selectorAgregar = document.getElementById("selectAgregarEtiquetaModal");

    cajaChips.innerHTML = borradorEtiquetasModal.length === 0
        ? `<span style="color:#64748b; font-size:0.86rem;">Sin etiquetas vinculadas.</span>`
        : borradorEtiquetasModal.map(e => `
            <span class="tag-chip-removable">
                ${e.nombre_etiqueta} <small>(${e.tipo_etiqueta})</small>
                <button type="button" onclick="quitarEtiquetaDeBorradorModal(${e.id_etiqueta})">✕</button>
            </span>`).join("");

    const idsAsignados = new Set(borradorEtiquetasModal.map(e => e.id_etiqueta));
    const disponibles = catalogoGlobalEtiquetas.filter(e => !idsAsignados.has(e.id_etiqueta));
    selectorAgregar.innerHTML = disponibles.length === 0
        ? `<option value="">Todas las etiquetas ya están asignadas</option>`
        : disponibles.map(e => `<option value="${e.id_etiqueta}">${e.nombre_etiqueta} (${e.tipo_etiqueta})</option>`).join("");
}

function quitarEtiquetaDeBorradorModal(idEtiqueta) {
    borradorEtiquetasModal = borradorEtiquetasModal.filter(e => e.id_etiqueta !== idEtiqueta);
    renderizarEditorEtiquetasModal();
}

function agregarEtiquetaEnBorradorModal() {
    const idSel = parseInt(document.getElementById("selectAgregarEtiquetaModal").value);
    const obj = catalogoGlobalEtiquetas.find(e => e.id_etiqueta === idSel);
    if (obj && !borradorEtiquetasModal.some(e => e.id_etiqueta === idSel)) {
        borradorEtiquetasModal.push(obj);
        renderizarEditorEtiquetasModal();
    }
}

function cerrarModalGestionEtiquetas() {
    borradorEtiquetasModal = [];
    document.getElementById("modalGestionEtiquetas").classList.add("hidden");
}

async function guardarCambiosEtiquetasModal() {
    if (!productoActualModal) return;
    await fetch(`/api/v1/catalogo/productos/${productoActualModal.id_producto}/etiquetas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids_etiquetas: borradorEtiquetasModal.map(e => e.id_etiqueta) })
    });
    document.getElementById("modalGestionEtiquetas").classList.add("hidden");
    await mostrarResumenEtiquetasProducto();
}

// --- Auditoría de Precios y Cupones Modulares (US012) ---
async function cargarDatosAuditoriaYCupones() {
    const [resProd, resCup] = await Promise.all([
        fetch("/api/v1/catalogo/productos"),
        fetch("/api/v1/catalogo/cupones")
    ]);
    const dataProd = await resProd.json();
    const dataCup = await resCup.json();

    todosLosProductosAuditoria = dataProd.productos || [];
    arbolMarcasCatalogo = dataProd.arbol_marcas || {};
    catalogoCupones = dataCup.cupones || [];

    const selProdEtiq = document.getElementById("selectProdEtiqueta");
    if (selProdEtiq && selProdEtiq.options.length === 0) {
        selProdEtiq.innerHTML = todosLosProductosAuditoria
            .map(p => `<option value="${p.id_producto}">${p.sku} · ${p.nombre}</option>`).join("");
    }

    const selCupon = document.getElementById("selectCuponActivo");
    selCupon.innerHTML = catalogoCupones.map(c => {
        const detalle = c.tipo_descuento === "PROMO_2X1"
            ? "2x1 -> S/ 0.00"
            : (c.tipo_descuento === "MONTO_FIJO" ? `- S/ ${c.valor_descuento.toFixed(2)}` : `- ${c.valor_descuento}%`);
        return `<option value="${c.id_cupon}">${c.codigo_cupon} · ${c.nombre_cupon} (${detalle})</option>`;
    }).join("");

    const selMarca = document.getElementById("selectFiltroMarca");
    const marcas = Object.keys(arbolMarcasCatalogo);
    const previa = selMarca.value;
    selMarca.innerHTML = marcas.map(m => `<option value="${m}">${m}</option>`).join("");
    if (marcas.includes(previa)) selMarca.value = previa;

    actualizarSelectorTiposPorMarca();
    renderizarTablaGeneralAuditoriaPrecios();
}

function obtenerCuponSeleccionadoObjeto() {
    const idCupon = parseInt(document.getElementById("selectCuponActivo").value);
    return catalogoCupones.find(c => c.id_cupon === idCupon) || null;
}

function esProductoElegibleParaCuponLocal(producto, cupon) {
    if (!cupon || cupon.tipo_descuento === "PROMO_2X1") return true;
    if (cupon.tipo_descuento === "MONTO_FIJO") return producto.precio_unitario > cupon.valor_descuento;
    return cupon.valor_descuento > 0 && cupon.valor_descuento < 100;
}

function actualizarElegibilidadProductosSegunCupon() {
    const cupon = obtenerCuponSeleccionadoObjeto();
    const banner = document.getElementById("infoReglaCuponSeleccionado");
    if (cupon) {
        banner.innerHTML = `<strong>${cupon.codigo_cupon}:</strong> ${cupon.descripcion_accion}`;
    }
    actualizarSelectorSKUsPorMarcaYTipo();
}

function actualizarSelectorTiposPorMarca() {
    const marca = document.getElementById("selectFiltroMarca").value;
    const tiposObj = arbolMarcasCatalogo[marca] || {};
    document.getElementById("selectFiltroTipo").innerHTML = Object.keys(tiposObj)
        .map(t => `<option value="${t}">${t} (${tiposObj[t].length} SKU)</option>`).join("");
    actualizarElegibilidadProductosSegunCupon();
}

function actualizarSelectorSKUsPorMarcaYTipo() {
    const marca = document.getElementById("selectFiltroMarca").value;
    const tipo = document.getElementById("selectFiltroTipo").value;
    const cupon = obtenerCuponSeleccionadoObjeto();
    const lista = (arbolMarcasCatalogo[marca] && arbolMarcasCatalogo[marca][tipo]) || [];

    document.getElementById("selectSKUIndividual").innerHTML = lista.map(p => {
        const elegible = esProductoElegibleParaCuponLocal(p, cupon);
        const nota = !elegible ? ` 🚫 [No aplicable: S/ ${p.precio_unitario.toFixed(2)} ≤ S/ ${cupon.valor_descuento.toFixed(2)}]` : "";
        return `<option value="${p.id_producto}" ${!elegible ? "disabled" : ""}>${p.sku} · ${p.nombre} (S/ ${p.precio_unitario.toFixed(2)})${nota}</option>`;
    }).join("");
}

async function aplicarCuponSeleccionadoAlSKU() {
    const idProd = parseInt(document.getElementById("selectSKUIndividual").value);
    const cupon = obtenerCuponSeleccionadoObjeto();
    const feedback = document.getElementById("mensajeResultadoCupon");
    if (!idProd || !cupon) return;

    const res = await fetch(`/api/v1/catalogo/productos/${idProd}/cupon`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_cupon: cupon.id_cupon })
    });
    const data = await res.json();
    feedback.style.color = data.aplicado ? "#0d9488" : "#b91c1c";
    feedback.textContent = (data.aplicado ? "✔ " : "⚠️ ") + data.mensaje;
    await cargarDatosAuditoriaYCupones();
}

async function quitarCuponDeSKUSeleccionado() {
    const idProd = parseInt(document.getElementById("selectSKUIndividual").value);
    const feedback = document.getElementById("mensajeResultadoCupon");
    if (!idProd) return;

    const res = await fetch(`/api/v1/catalogo/productos/${idProd}/cupon`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_cupon: null })
    });
    const data = await res.json();
    feedback.style.color = "#0284c7";
    feedback.textContent = `✔ ${data.mensaje}`;
    await cargarDatosAuditoriaYCupones();
}

function seleccionarProductoEnArbolDesdeTabla(idProducto, marca, categoria) {
    document.getElementById("selectFiltroMarca").value = marca;
    actualizarSelectorTiposPorMarca();
    document.getElementById("selectFiltroTipo").value = categoria;
    actualizarSelectorSKUsPorMarcaYTipo();
    document.getElementById("selectSKUIndividual").value = idProducto;
}

function renderizarTablaGeneralAuditoriaPrecios() {
    const contenedor = document.getElementById("contenedorTablaAuditoriaPrecios");
    const filas = todosLosProductosAuditoria.map(p => `
        <tr>
            <td><code>${p.sku}</code></td>
            <td><strong>${p.nombre}</strong></td>
            <td><span class="brand-badge">${p.marca}</span> <small>${p.categoria}</small></td>
            <td style="text-align:center;">
                <span class="stock-badge ${p.stock_actual > 0 ? 'stock-verde' : 'stock-rojo'}">
                    ${p.stock_actual > 0 ? p.stock_actual + ' unid.' : 'Agotado (0)'}
                </span>
            </td>
            <td>S/ ${p.precio_unitario.toFixed(2)}</td>
            <td>${p.precio_promocion !== null ? `<strong style="color:#0d9488;">S/ ${p.precio_promocion.toFixed(2)}</strong>` : '<span style="color:#94a3b8;">—</span>'}</td>
            <td>${p.codigo_cupon ? `<span class="tag-badge">🎟️ ${p.codigo_cupon}</span>` : '<span style="color:#94a3b8;">Ninguno</span>'}</td>
            <td style="text-align:right;"><strong style="color:#0284c7;">S/ ${p.precio_vigente_caja.toFixed(2)}</strong></td>
            <td style="text-align:center;">
                <button class="btn btn-sand" style="padding:0.35rem 0.65rem; font-size:0.78rem;"
                        onclick="seleccionarProductoEnArbolDesdeTabla(${p.id_producto}, '${p.marca}', '${p.categoria}')">
                    🎯 Seleccionar
                </button>
            </td>
        </tr>`).join("");

    contenedor.innerHTML = `
        <table class="audit-prices-table">
            <thead>
                <tr>
                    <th>SKU Único</th>
                    <th>Producto</th>
                    <th>Marca / Tipo</th>
                    <th style="text-align:center;">Stock</th>
                    <th>Precio Actual</th>
                    <th>Precio Promo</th>
                    <th>Cupón</th>
                    <th style="text-align:right;">Cobro Caja</th>
                    <th style="text-align:center;">Acción</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>`;
}

// --- Modal Crear Cupón ---
function abrirModalCrearCupon() {
    document.getElementById("inputCuponNombre").value = "";
    document.getElementById("inputCuponCodigo").value = "";
    document.getElementById("inputCuponDescripcion").value = "";
    document.getElementById("selectCuponTipo").value = "MONTO_FIJO";
    document.getElementById("inputCuponValor").value = "50";
    document.getElementById("inputCuponValor").disabled = false;
    document.getElementById("modalCrearCupon").classList.remove("hidden");
}

function cerrarModalCrearCupon() {
    document.getElementById("modalCrearCupon").classList.add("hidden");
}

function ajustarInputValorSegunTipoCupon() {
    const tipo = document.getElementById("selectCuponTipo").value;
    const input = document.getElementById("inputCuponValor");
    input.disabled = tipo === "PROMO_2X1";
    if (tipo === "PROMO_2X1") input.value = "100";
}

async function guardarNuevoCuponModal() {
    const res = await fetch("/api/v1/catalogo/cupones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nombre_cupon: document.getElementById("inputCuponNombre").value.trim(),
            codigo_cupon: document.getElementById("inputCuponCodigo").value.trim(),
            descripcion_accion: document.getElementById("inputCuponDescripcion").value.trim(),
            tipo_descuento: document.getElementById("selectCuponTipo").value,
            valor_descuento: parseFloat(document.getElementById("inputCuponValor").value || "0")
        })
    });
    const data = await res.json();
    if (!data.creado) {
        alert(data.mensaje);
        return;
    }
    cerrarModalCrearCupon();
    await cargarDatosAuditoriaYCupones();
    document.getElementById("selectCuponActivo").value = data.cupon.id_cupon;
    actualizarElegibilidadProductosSegunCupon();
}

// SIG // Begin signature block
// SIG // MIInXAYJKoZIhvcNAQcCoIInTTCCJ0kCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // GDLlNqc3EWIPWwtmz2XePhUse4x0LRBoamwnP+2lXI6g
// SIG // ggzPMIIGCjCCA/KgAwIBAgITMwAAAf7+iki1zsRg8QAA
// SIG // AAAB/jANBgkqhkiG9w0BAQsFADBXMQswCQYDVQQGEwJV
// SIG // UzEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5n
// SIG // IFBDQSAyMDI0MB4XDTI2MDQxNjE4NTg1MloXDTI3MDQx
// SIG // NTE4NTg1MlowgYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xMjAw
// SIG // BgNVBAMTKU1pY3Jvc29mdCAzcmQgUGFydHkgQXBwbGlj
// SIG // YXRpb24gQ29tcG9uZW50MIIBIjANBgkqhkiG9w0BAQEF
// SIG // AAOCAQ8AMIIBCgKCAQEAv1RjgRSjfl8SE93CFRZLi4N7
// SIG // hmn0IkvQqsfJc1+80zFVHlZnA2HGF7IpvPeqinp4SBpe
// SIG // dfM69fqNJ+id+q8ZhHP6OsW2//iI3bQED00ekouNByvJ
// SIG // H2QcqJATkcgsxjOPVYj4SOqcfR16iGU3KMpNZvydzu/Z
// SIG // eOxbpZnfl0mcLmeqDdjexv5f0w8dieu9Jh26TIL1zv7o
// SIG // Sd0St8Y1eZFQCZeIce5m6jGgRdho0LoIHtdLfR3a9giZ
// SIG // KYzuHiLmOh3W6uu7kwf24wiRsdRtU0yp2QsjaWGgrdpX
// SIG // VRMwyzaKvi4OMNJENmSFzOCZcGMBQHen5QRXas4T2mx3
// SIG // EmZEByYdYQIDAQABo4IBmzCCAZcwDgYDVR0PAQH/BAQD
// SIG // AgeAMB8GA1UdJQQYMBYGCisGAQQBgjdMEQEGCCsGAQUF
// SIG // BwMDMB0GA1UdDgQWBBQmGTbv1kPrIUXGSzs97yJZtFaq
// SIG // FTBFBgNVHREEPjA8pDowODEeMBwGA1UECxMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMRYwFAYDVQQFEw0yMzE1MjIr
// SIG // NTA3NTMxMB8GA1UdIwQYMBaAFH9ZP1Qh2q1P7wXl5qPX
// SIG // LQaUEggxMGAGA1UdHwRZMFcwVaBToFGGT2h0dHA6Ly93
// SIG // d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY3JsL01pY3Jv
// SIG // c29mdCUyMENvZGUlMjBTaWduaW5nJTIwUENBJTIwMjAy
// SIG // NC5jcmwwbQYIKwYBBQUHAQEEYTBfMF0GCCsGAQUFBzAC
// SIG // hlFodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3Bz
// SIG // L2NlcnRzL01pY3Jvc29mdCUyMENvZGUlMjBTaWduaW5n
// SIG // JTIwUENBJTIwMjAyNC5jcnQwDAYDVR0TAQH/BAIwADAN
// SIG // BgkqhkiG9w0BAQsFAAOCAgEAHOf/iJrPCpgPWpNTX6BF
// SIG // WYi9rR5/fn97/d+ZHac+/R/2bPc++JzQ4EfFVt6bM0Zb
// SIG // 4EphOAzJQI9B+yltQST/qG0oVMpAUIs8vJgBRbimu/r0
// SIG // OMhZZbRkWfYsKK31vac0B3PSRhkj/0pN/8gApEuATBsp
// SIG // NT6VPZB0SfQ4rg/U/sohdvtoRIYqrP1P+kBwWeQUthaM
// SIG // oOVl5nI8upWghZZMeCj6kx4OeXAPp6zzYlK5mEnoCW4J
// SIG // awcxoaqhFhtJTVaEWWDK5vkjGeBbNbvwkK4e3/16gGW+
// SIG // 8WklZtzg10KPhqX0jRV0bG4IiItEPUqUQyRj2aN2EACH
// SIG // FJeJBstrSc5BSp9vnmRcvdnrnnwGf2NSPiR1193Lx/0W
// SIG // LhlJkscqM7Qv2Dsu6feXS5xLLIPRUEKPCA0Y5xJq1+f7
// SIG // JXB1WxQxAxVKZq6tT1X28pe99xIGiyQYtiP1PSy0TqMJ
// SIG // ePWicHUEIYtWn9KifSvZKA/LrlKCqiG2Yg5zSeZ+Ezvi
// SIG // Q3bLHQy43Mog2KtfArR4R+ZertkNoDe7w9LNUjwPvV2H
// SIG // kYFY4FjXNFZBLLaDdECMu79XQVoC5ANGzb7VnTM1plM5
// SIG // rN1+suCJ8ygMo7rUa1/Vi2zRlYuyfZB7WnAZUknCAUI1
// SIG // kFEJexnmZXQYBV+dokvoirtl6k4/Uu5NDOuryxqYFZFc
// SIG // Nyswgga9MIIEpaADAgECAhMzAAAAOTu2Nxm/Bh1nAAAA
// SIG // AAA5MA0GCSqGSIb3DQEBDAUAMIGIMQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMTIwMAYDVQQDEylNaWNyb3NvZnQgUm9vdCBD
// SIG // ZXJ0aWZpY2F0ZSBBdXRob3JpdHkgMjAxMTAeFw0yNDA4
// SIG // MDgyMDU0MThaFw0zNjAzMjIyMjEzMDRaMFcxCzAJBgNV
// SIG // BAYTAlVTMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9y
// SIG // YXRpb24xKDAmBgNVBAMTH01pY3Jvc29mdCBDb2RlIFNp
// SIG // Z25pbmcgUENBIDIwMjQwggIiMA0GCSqGSIb3DQEBAQUA
// SIG // A4ICDwAwggIKAoICAQDYAZwe4zjHqpUWBzWtuub+CGPX
// SIG // x/EyoXph3zyDXtYKS2ld3YYN9uFsB9Oi3B26Z7AbpAgz
// SIG // Yra8qNHbUvxFuiP8hC/2y0mPISqW30LlrrAT6/ams2HA
// SIG // 8Qlv6p42+SbCNbPGzToN21QE70FS+LXH9N2k8nLM/EHg
// SIG // nTNJf8h0TmyfUKmszNa+lTxDieyy/rhBG+98OkArobPP
// SIG // Wtbr9c3qzmDJ7J3kUcAm6cltdSHIIFNHESgw6taY1Scy
// SIG // GyBevqIl120XjrIHiPM7tRckHytH1ZGsmvEplR0P7Tn9
// SIG // t5meFvZNEYttkFvad1IEguTlA5LSscXAphi+rVy3zhkl
// SIG // hyCFeGK0yU0+jzbcuURKIxybmRwK5BfVZx0xEVqE4wM3
// SIG // yN5D/uW+GpVHYYAGe7bTrtW1Z13x2qj2Jdqz7NtI4tNy
// SIG // zlVrIf62nYBNe3rOYS/repVdHlR61YbLLETlibs9jFzA
// SIG // re4sO5RTxvS1yho7JqJ59oKLRnRyLhIOSZyTCVZosXeS
// SIG // 0ZZJoGEWSs4cUgsMqBiKtD4WgO2PlT3LeaQh5Io3CCA5
// SIG // tJ5ZCvtCsnqaJXKhptE/xmEETIRyZRjjplUKKd+sFFVG
// SIG // JJVMvvrw1nhIBKOLO4cTepiG39jEiEP4iHzGYCcQuvaL
// SIG // pDFFwqzgt0pBP8SJIKX5dtjDNYrZGd+ZzV5DKJVNZQID
// SIG // AQABo4IBTjCCAUowDgYDVR0PAQH/BAQDAgGGMBAGCSsG
// SIG // AQQBgjcVAQQDAgEAMB0GA1UdDgQWBBR/WT9UIdqtT+8F
// SIG // 5eaj1y0GlBIIMTAZBgkrBgEEAYI3FAIEDB4KAFMAdQBi
// SIG // AEMAQTAPBgNVHRMBAf8EBTADAQH/MB8GA1UdIwQYMBaA
// SIG // FHItOgIxkEO5FAVO4eqnxzHRI4k0MFoGA1UdHwRTMFEw
// SIG // T6BNoEuGSWh0dHA6Ly9jcmwubWljcm9zb2Z0LmNvbS9w
// SIG // a2kvY3JsL3Byb2R1Y3RzL01pY1Jvb0NlckF1dDIwMTFf
// SIG // MjAxMV8wM18yMi5jcmwwXgYIKwYBBQUHAQEEUjBQME4G
// SIG // CCsGAQUFBzAChkJodHRwOi8vd3d3Lm1pY3Jvc29mdC5j
// SIG // b20vcGtpL2NlcnRzL01pY1Jvb0NlckF1dDIwMTFfMjAx
// SIG // MV8wM18yMi5jcnQwDQYJKoZIhvcNAQEMBQADggIBABSU
// SIG // HzgoT+6J5+nyyDCq0pTdVmCsAxYAHXcpjlDtxazPHewf
// SIG // 1v4kOg8V7A5+w+VuMDMGHi8rLXBKn5I8+DVEUYGs8jLu
// SIG // ckc0IeC6owOLUrU3CYdaKRMaO55+T7jwWJ27tPkx0rlR
// SIG // 03tFU0z1YYpcv6Yhaw6N2sUPT+AvjpecnrftoE33pCAk
// SIG // ucUvnGH0iL4J9CZLFQVTGFSOUBbv6oZy4bBBRFMxvH77
// SIG // 9IY4JDvpZKVfbcuhpDeL3Z3e8mukOmkfct+GojNapsWs
// SIG // QYujlJ8jZen5Lrp/3YkxZ2Ay06aTpK/5oOVknwog1TDQ
// SIG // sbY+MDyguTph5tQ0CLfzDaJG2x91BrBT9UG87C6HLkqi
// SIG // wrx9PSKN3wz05rHEfWO+RuKl+0U1/AHQT6NCOjhKI39/
// SIG // c7hWbdKjh5uuWFkBOvXGTNrnhNTAdOXTTYByvYExO8yr
// SIG // yv34PAdqo1vPDE/1heVebr2RramvRUi9kWswKwPqwz7n
// SIG // +iRmM+B6YDGRweEurM1kimAb9FYrAs38YHlPnarl1vW3
// SIG // dGrmJTgefAz3DmCnXN0nveIPsS+KXBIWweeCToAJMGE7
// SIG // v/XS3h9qQ6niWQAAVQ1kUAml3zuS4MisCgi2F6YoK2WA
// SIG // o1EgXK/lXvDxVjIVU0JdL+KvCfwFJkDeVuJ9dNXGNi+A
// SIG // Oxk0BtYd9hxwL30BElj9MYIZ5TCCGeECAQEwbjBXMQsw
// SIG // CQYDVQQGEwJVUzEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29k
// SIG // ZSBTaWduaW5nIFBDQSAyMDI0AhMzAAAB/v6KSLXOxGDx
// SIG // AAAAAAH+MA0GCWCGSAFlAwQCAQUAoIGuMBkGCSqGSIb3
// SIG // DQEJAzEMBgorBgEEAYI3AgEEMBwGCisGAQQBgjcCAQsx
// SIG // DjAMBgorBgEEAYI3AgEVMC8GCSqGSIb3DQEJBDEiBCB2
// SIG // Daj5qzVcfbVJND9LyiopI9pwDgkOps37x/Dz5J2GiDBC
// SIG // BgorBgEEAYI3AgEMMTQwMqAUgBIATQBpAGMAcgBvAHMA
// SIG // bwBmAHShGoAYaHR0cDovL3d3dy5taWNyb3NvZnQuY29t
// SIG // MA0GCSqGSIb3DQEBAQUABIIBAIFfPq9QP9BJmX9SGDho
// SIG // 0OZLFlgKsx2SUqyPnwL6AIey5bK9+uHjlsAQRv4dx2Ic
// SIG // A91xpv6F5qq0UDNT61hqn+BiNqsmSlRYqr1vzI2STyiF
// SIG // sQXnv0rtAwDVLmhadVVUDa71JrbDOhZ+YIbcArhk+BqI
// SIG // 3Fh1mIltxd+onPcFdOtD9wQD5G9ITeBHud0SzrBDPMfj
// SIG // 8BfBXCOOvMjdvc3OB5nmfoqPcg4Qg31m4Xy74axLkqQ8
// SIG // EIiliG1+M6YQZQubtXO55lxtfMj9ZwAr3fNoLE6yczov
// SIG // rjZhxwovnNP0toQQHbsLlhBec5IejIMSt4pjqmfglrZO
// SIG // jtgFye7qg8ZDL2OhgheXMIIXkwYKKwYBBAGCNwMDATGC
// SIG // F4Mwghd/BgkqhkiG9w0BBwKgghdwMIIXbAIBAzEPMA0G
// SIG // CWCGSAFlAwQCAQUAMIIBUgYLKoZIhvcNAQkQAQSgggFB
// SIG // BIIBPTCCATkCAQEGCisGAQQBhFkKAwEwMTANBglghkgB
// SIG // ZQMEAgEFAAQguSkIAwg4NM/esgiRSoRBFYtcfoBb9tsl
// SIG // wqXQ9XWLJ9QCBmqpquVVHhgTMjAyNjA5MjkxODMyMjUu
// SIG // MzUyWjAEgAIB9KCB0aSBzjCByzELMAkGA1UEBhMCVVMx
// SIG // EzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
// SIG // ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjElMCMGA1UECxMcTWljcm9zb2Z0IEFtZXJpY2Eg
// SIG // T3BlcmF0aW9uczEnMCUGA1UECxMeblNoaWVsZCBUU1Mg
// SIG // RVNOOjg2MDMtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNy
// SIG // b3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNloIIR7TCCByAw
// SIG // ggUIoAMCAQICEzMAAAIlgMc3xs2qd0kAAQAAAiUwDQYJ
// SIG // KoZIhvcNAQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwHhcNMjYwMjE5MTk0MDAxWhcNMjcwNTE3MTk0
// SIG // MDAxWjCByzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldh
// SIG // c2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNV
// SIG // BAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjElMCMGA1UE
// SIG // CxMcTWljcm9zb2Z0IEFtZXJpY2EgT3BlcmF0aW9uczEn
// SIG // MCUGA1UECxMeblNoaWVsZCBUU1MgRVNOOjg2MDMtMDVF
// SIG // MC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1T
// SIG // dGFtcCBTZXJ2aWNlMIICIjANBgkqhkiG9w0BAQEFAAOC
// SIG // Ag8AMIICCgKCAgEApvESD9HiwOOlXAj6L75qrCJTeqpJ
// SIG // s+SLB1plFNJ3lKqfLhsWnXqPksFgQsEOWpWSPwzXaV38
// SIG // omS2Uel2IKUTxc3qSJezgg2+DbRLJCQiGQ5EDDcKx/WM
// SIG // FMru9RhooLCyMXpXh7QN7raFU3h40tW/FJ8DkUbZJypM
// SIG // q1AK0+maQdq6HSHJnC3L98d8MIGJTrNBRIORLFa2W+yz
// SIG // XP53dG1w6fh0zllrovHqE1cCXi8XFT/OvaBfJYuUlPNW
// SIG // mtrRievybHo4s/STFvEiVygU9gwlzDlJArBo6Jz2Uan7
// SIG // 6DEiEGYLWjk8gCZa77MtE2e/F6xqqMoLUIpkJ2zgC+Cj
// SIG // S0grluU2REBkxyzkCRoIIG94+YCgu+/PkSDyQPp/4Zhy
// SIG // f8eKk/x00z6FXjAnLgSlq0F0dfv6WGrtxcHtLViMhvi1
// SIG // s5Ea/2TTz7qXANmHIt6p/B0fUcL0KKakjScJ9kYumpvA
// SIG // EMn1VcvwQcNLeo6aET48Cr7lI3ws6WnunbjsULUNVwzf
// SIG // TwNspfbA5KP/gF1f0jnvHmvEKEHL97NxK5Bvi6eoZ78O
// SIG // jjD4mp+IIDZEbYLQe66NToqKTlFyZ/WORDtyVAFzXLjP
// SIG // ZvuTMtVRLrxsrYAB97sZrJU51t2G632s2skgkkp1pIWj
// SIG // md94YG7lEHx+59jRRAFHP3Bc35gkFIpForJyWMsCAwEA
// SIG // AaOCAUkwggFFMB0GA1UdDgQWBBSxONKqF07jB19wH2VL
// SIG // tZ/J8dofdzAfBgNVHSMEGDAWgBSfpxVdAF5iXYP05dJl
// SIG // pxtTNRnpcjBfBgNVHR8EWDBWMFSgUqBQhk5odHRwOi8v
// SIG // d3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NybC9NaWNy
// SIG // b3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAxMCgx
// SIG // KS5jcmwwbAYIKwYBBQUHAQEEYDBeMFwGCCsGAQUFBzAC
// SIG // hlBodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3Bz
// SIG // L2NlcnRzL01pY3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQ
// SIG // Q0ElMjAyMDEwKDEpLmNydDAMBgNVHRMBAf8EAjAAMBYG
// SIG // A1UdJQEB/wQMMAoGCCsGAQUFBwMIMA4GA1UdDwEB/wQE
// SIG // AwIHgDANBgkqhkiG9w0BAQsFAAOCAgEAB533NslMqB2W
// SIG // 778lShbl4eR8cRyLyGkfSVqSHyEyZXPyotN47kfr3JM6
// SIG // t7aeXxR+Sy+3iBV0SLqHsDLL1nha1rn661uB4ZoQsJKg
// SIG // K3wNQtMZPh2mLNjuPGEsTF/ZYEtZE0yG92LH6BXRaSrq
// SIG // z39p3NmHeMC4PhYMJpMZHshNzFClZ2vEmXlaRI50ubnB
// SIG // XJOLKz8CtjkQH+9CNtxhsj4aoCCmaYTV4UrHEwELMiKg
// SIG // eRsAzHUVeSyt+zX1OGJsbwmId0xWBPxodNUOsib3/R8Y
// SIG // hGacFvqFJNIK7h6G4N7ICEea34FKPJd9L1J2g2DHDwAp
// SIG // WhTAv0Gx2UmlIVl2RtTjnDKdIPb2EDSwxKhV9o5arr81
// SIG // UksLR7ZtSk5XQo0RA/pHQsm3D8Wz2pcCYoF3NQbCPQor
// SIG // Z039JY8G/TZGfyVSPPw+tq1184c+Bd7tIlRs8J3BmsUc
// SIG // Rxv17+J066ZDnnqaGGzQWzFkthtaj914+6VX9PuKkcgK
// SIG // idLLY0I6FTiSJlT1kY8+T0dw5+mnUFTASQzOoA649a2U
// SIG // xVYArU4o6hmUhs716RpBd72LMhOmQ5mv5BnYlHubGniO
// SIG // pR+uj4lll4Ksbe7MthM79MiI0lb/njDk9kDFImelgnO4
// SIG // FbQJl6X3iLrPjZoBbzPiHNV+fHuCPRC+GUgInUqVltBm
// SIG // UyzQtNpq8i4wggdxMIIFWaADAgECAhMzAAAAFcXna54C
// SIG // m0mZAAAAAAAVMA0GCSqGSIb3DQEBCwUAMIGIMQswCQYD
// SIG // VQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
// SIG // A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
// SIG // IENvcnBvcmF0aW9uMTIwMAYDVQQDEylNaWNyb3NvZnQg
// SIG // Um9vdCBDZXJ0aWZpY2F0ZSBBdXRob3JpdHkgMjAxMDAe
// SIG // Fw0yMTA5MzAxODIyMjVaFw0zMDA5MzAxODMyMjVaMHwx
// SIG // CzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9u
// SIG // MRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
// SIG // b3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jv
// SIG // c29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMIICIjANBgkq
// SIG // hkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA5OGmTOe0ciEL
// SIG // eaLL1yR5vQ7VgtP97pwHB9KpbE51yMo1V/YBf2xK4OK9
// SIG // uT4XYDP/XE/HZveVU3Fa4n5KWv64NmeFRiMMtY0Tz3cy
// SIG // wBAY6GB9alKDRLemjkZrBxTzxXb1hlDcwUTIcVxRMTeg
// SIG // Cjhuje3XD9gmU3w5YQJ6xKr9cmmvHaus9ja+NSZk2pg7
// SIG // uhp7M62AW36MEBydUv626GIl3GoPz130/o5Tz9bshVZN
// SIG // 7928jaTjkY+yOSxRnOlwaQ3KNi1wjjHINSi947SHJMPg
// SIG // yY9+tVSP3PoFVZhtaDuaRr3tpK56KTesy+uDRedGbsoy
// SIG // 1cCGMFxPLOJiss254o2I5JasAUq7vnGpF1tnYN74kpEe
// SIG // HT39IM9zfUGaRnXNxF803RKJ1v2lIH1+/NmeRd+2ci/b
// SIG // fV+AutuqfjbsNkz2K26oElHovwUDo9Fzpk03dJQcNIIP
// SIG // 8BDyt0cY7afomXw/TNuvXsLz1dhzPUNOwTM5TI4CvEJo
// SIG // LhDqhFFG4tG9ahhaYQFzymeiXtcodgLiMxhy16cg8ML6
// SIG // EgrXY28MyTZki1ugpoMhXV8wdJGUlNi5UPkLiWHzNgY1
// SIG // GIRH29wb0f2y1BzFa/ZcUlFdEtsluq9QBXpsxREdcu+N
// SIG // +VLEhReTwDwV2xo3xwgVGD94q0W29R6HXtqPnhZyacau
// SIG // e7e3PmriLq0CAwEAAaOCAd0wggHZMBIGCSsGAQQBgjcV
// SIG // AQQFAgMBAAEwIwYJKwYBBAGCNxUCBBYEFCqnUv5kxJq+
// SIG // gpE8RjUpzxD/LwTuMB0GA1UdDgQWBBSfpxVdAF5iXYP0
// SIG // 5dJlpxtTNRnpcjBcBgNVHSAEVTBTMFEGDCsGAQQBgjdM
// SIG // g30BATBBMD8GCCsGAQUFBwIBFjNodHRwOi8vd3d3Lm1p
// SIG // Y3Jvc29mdC5jb20vcGtpb3BzL0RvY3MvUmVwb3NpdG9y
// SIG // eS5odG0wEwYDVR0lBAwwCgYIKwYBBQUHAwgwGQYJKwYB
// SIG // BAGCNxQCBAweCgBTAHUAYgBDAEEwCwYDVR0PBAQDAgGG
// SIG // MA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0jBBgwFoAU1fZW
// SIG // y4/oolxiaNE9lJBb186aGMQwVgYDVR0fBE8wTTBLoEmg
// SIG // R4ZFaHR0cDovL2NybC5taWNyb3NvZnQuY29tL3BraS9j
// SIG // cmwvcHJvZHVjdHMvTWljUm9vQ2VyQXV0XzIwMTAtMDYt
// SIG // MjMuY3JsMFoGCCsGAQUFBwEBBE4wTDBKBggrBgEFBQcw
// SIG // AoY+aHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraS9j
// SIG // ZXJ0cy9NaWNSb29DZXJBdXRfMjAxMC0wNi0yMy5jcnQw
// SIG // DQYJKoZIhvcNAQELBQADggIBAJ1VffwqreEsH2cBMSRb
// SIG // 4Z5yS/ypb+pcFLY+TkdkeLEGk5c9MTO1OdfCcTY/2mRs
// SIG // fNB1OW27DzHkwo/7bNGhlBgi7ulmZzpTTd2YurYeeNg2
// SIG // LpypglYAA7AFvonoaeC6Ce5732pvvinLbtg/SHUB2Rje
// SIG // bYIM9W0jVOR4U3UkV7ndn/OOPcbzaN9l9qRWqveVtihV
// SIG // J9AkvUCgvxm2EhIRXT0n4ECWOKz3+SmJw7wXsFSFQrP8
// SIG // DJ6LGYnn8AtqgcKBGUIZUnWKNsIdw2FzLixre24/LAl4
// SIG // FOmRsqlb30mjdAy87JGA0j3mSj5mO0+7hvoyGtmW9I/2
// SIG // kQH2zsZ0/fZMcm8Qq3UwxTSwethQ/gpY3UA8x1RtnWN0
// SIG // SCyxTkctwRQEcb9k+SS+c23Kjgm9swFXSVRk2XPXfx5b
// SIG // RAGOWhmRaw2fpCjcZxkoJLo4S5pu+yFUa2pFEUep8beu
// SIG // yOiJXk+d0tBMdrVXVAmxaQFEfnyhYWxz/gq77EFmPWn9
// SIG // y8FBSX5+k77L+DvktxW/tM4+pTFRhLy/AsGConsXHRWJ
// SIG // jXD+57XQKBqJC4822rpM+Zv/Cuk0+CQ1ZyvgDbjmjJnW
// SIG // 4SLq8CdCPSWU5nR0W2rRnj7tfqAxM328y+l7vzhwRNGQ
// SIG // 8cirOoo6CGJ/2XBjU02N7oJtpQUQwXEGahC0HVUzWLOh
// SIG // cGbyoYIDUDCCAjgCAQEwgfmhgdGkgc4wgcsxCzAJBgNV
// SIG // BAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYD
// SIG // VQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQg
// SIG // Q29ycG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBB
// SIG // bWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGll
// SIG // bGQgVFNTIEVTTjo4NjAzLTA1RTAtRDk0NzElMCMGA1UE
// SIG // AxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZaIj
// SIG // CgEBMAcGBSsOAwIaAxUAU2/myjjwIwgX5Yc8ORFwbkls
// SIG // Xg6ggYMwgYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UE
// SIG // CBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEe
// SIG // MBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYw
// SIG // JAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0Eg
// SIG // MjAxMDANBgkqhkiG9w0BAQsFAAIFAO5l84swIhgPMjAy
// SIG // NjA5MjkwODIxMzFaGA8yMDI2MDkzMDA4MjEzMVowdzA9
// SIG // BgorBgEEAYRZCgQBMS8wLTAKAgUA7mXziwIBADAKAgEA
// SIG // AgIlqwIB/zAHAgEAAgISuDAKAgUA7mdFCwIBADA2Bgor
// SIG // BgEEAYRZCgQCMSgwJjAMBgorBgEEAYRZCgMCoAowCAIB
// SIG // AAIDB6EgoQowCAIBAAIDAYagMA0GCSqGSIb3DQEBCwUA
// SIG // A4IBAQBOOi9AK51bTprMGcIaR1VuqQGu7KnddTZ5HbCv
// SIG // HlEdMw+EZjrGTn/yac3JNreFTgjdiQcD+wDIOqyb8/eL
// SIG // zBXfqgORtG/Y/70xtVUfxn2oucrD8+dzy5nbNLyL3UaR
// SIG // 4u26ZIaU+KhpEMQZ5mnE0pMlph+Tq5xfLAay5pLAXG/b
// SIG // sqq9MNs4jxDHL6/WW+zhx6vS+6/YZu5Yl+ft4jYdNhnp
// SIG // yHWAwxEZSH8UZGvNVcgh7GbfaSfCCyxKRbDjw7efVSTA
// SIG // B0ajsKl6NP2dW0wFZhWNopyz5oau30uBHd+Vg47f0t8/
// SIG // NjokxqDmj8aIFNO5MwW+3KwXZ0FrPn8CFEPYaObOMYIE
// SIG // DTCCBAkCAQEwgZMwfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTACEzMAAAIlgMc3xs2qd0kAAQAAAiUwDQYJYIZI
// SIG // AWUDBAIBBQCgggFKMBoGCSqGSIb3DQEJAzENBgsqhkiG
// SIG // 9w0BCRABBDAvBgkqhkiG9w0BCQQxIgQgaRZe6hl22ITU
// SIG // /jnrzRzs57RnksOkYgw3Y5oVV4yOWN4wgfoGCyqGSIb3
// SIG // DQEJEAIvMYHqMIHnMIHkMIG9BCBWDe6Iejjd8vdgpgJf
// SIG // 5RdAmMK41lkD+nQlMWoz0hyhEDCBmDCBgKR+MHwxCzAJ
// SIG // BgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAw
// SIG // DgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3Nv
// SIG // ZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29m
// SIG // dCBUaW1lLVN0YW1wIFBDQSAyMDEwAhMzAAACJYDHN8bN
// SIG // qndJAAEAAAIlMCIEIMN1Odz3uRxuvkTzHj2FAuK5/J8x
// SIG // 2usJ1s5RgM07iRclMA0GCSqGSIb3DQEBCwUABIICAG+D
// SIG // qCA2tR0p74ok2KP4X5aGfifs2EmyCEAcemW/0krtyYFI
// SIG // qbDReYoFx7Yj8eCF+Pc+RIoTF4qu/Qvdld8TCIEGHDAc
// SIG // bcOErp5C3Z66mGKjUi5bs5hujPtV69A6nj/uwQbQJhJT
// SIG // HXVJ5MgBq+cQMMo2rm7cmMePPApjesr/VryMhEmYWJZI
// SIG // BCvremR+XdqYRmSGrD6IMcjRlC3hgc32hI7TkrnCpLXP
// SIG // 0OpyH1JRLzTD9WXFx2ytaZSngb8Vfp3GV7AOwcQYHDhn
// SIG // SAtr2v9eQNzRKHn3veaESvZNVyB/cbgNe+TW2AUpD5Gv
// SIG // Z04FEOW7CBFMJ+XQSqLGKOyDAEyLG1eMpxG0rxWE2Wcx
// SIG // SlMVcxo3jQz8F8+kAmcb8HXmRyg41cCLALAMBi17gpw6
// SIG // sQ0RGNfBomzYeDwPhEWLF7DQJqSO4oXTPzXxhzN2k6Nc
// SIG // P3Tsb7edLIjvmoMdaMCjL8BBlVMDstHRwqkH1ktZ8tfn
// SIG // V++Z0TEWz7cgwMoW4Nz5XOdDg6emJfa9jEPdpLKxpbgR
// SIG // cpf8L6XiXd+BNs6ZWxk34z2md4aulLYSrYVReJFOl2dA
// SIG // Vc1z1Qgt8ishD1SPDItDMLBWIWo+wnUk8GWMGke4egXz
// SIG // 7/U/NvAe+kzAwYTq/jY7tBDdNDue6E07FmZMYzARI4e2
// SIG // HvOHxMRambtILGr8Yo56
// SIG // End signature block
