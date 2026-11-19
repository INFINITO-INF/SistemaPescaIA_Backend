let productosEnPantalla = [];
let catalogoGlobalEtiquetas = [];

document.addEventListener("DOMContentLoaded", async () => {
    verificarSaludBackend();
    await verificarBloqueoMantenimientoInicial();
    await recargarCatalogoGlobalEtiquetas();
    await cargarCategoriasPrincipales(1);
    await ejecutarBusquedaPorCategoria(1, "Cañas de Pesca", true);
    await cargarOpcionesFiltrosSprint2();
});

// --- Control de Filtros Técnicos Colapsables en Fila ---
function togglePanelFiltrosTecnicos() {
    const panel = document.getElementById("panelFiltrosTecnicos");
    const flecha = document.getElementById("flechaFiltros");
    const oculto = panel.classList.contains("hidden");
    if (oculto) {
        panel.classList.remove("hidden");
        flecha.textContent = "▴";
    } else {
        panel.classList.add("hidden");
        flecha.textContent = "▾";
    }
}

// --- Solicitud de PIN al presionar el ícono ⚙️ ---
function solicitarAccesoAdministrador() {
    // Si ya tiene sesión activa en esta pestaña, entra directo a /admin
    if (sessionStorage.getItem("admin_pin_sesion")) {
        window.location.href = "/admin";
        return;
    }
    document.getElementById("inputPinAccesoAdmin").value = "";
    document.getElementById("mensajeErrorPinAdmin").textContent = "";
    document.getElementById("modalPinAdmin").classList.remove("hidden");
    setTimeout(() => document.getElementById("inputPinAccesoAdmin").focus(), 100);
}

function cerrarModalPinAdmin() {
    document.getElementById("modalPinAdmin").classList.add("hidden");
}

async function verificarPinYEntrarAdmin() {
    const pin = document.getElementById("inputPinAccesoAdmin").value;
    const errorEl = document.getElementById("mensajeErrorPinAdmin");

    const res = await fetch("/api/v1/admin/autenticar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
    });
    const data = await res.json();

    if (!data.autorizado) {
        errorEl.textContent = "⚠️ " + data.mensaje;
        return;
    }

    sessionStorage.setItem("admin_pin_sesion", pin);
    window.location.href = "/admin";
}

// --- Retorno al Inicio ---
async function regresarPaginaInicial() {
    await fetch("/api/v1/busqueda/limpiar", { method: "POST" });
    await fetch("/api/v1/busqueda/categorias/volver", { method: "POST" });

    document.getElementById("inputBusqueda").value = "";
    document.getElementById("chkSoloDisponibles").checked = false;
    document.getElementById("selectOrdenCatalogo").value = "relevancia";
    document.getElementById("listaAutocompletado").classList.add("hidden");
    document.getElementById("alertaSinResultados").classList.add("hidden");
    document.getElementById("contenedorSubcategorias").classList.add("hidden");
    document.getElementById("btnVolverCategorias").classList.add("hidden");

    await cargarCategoriasPrincipales(1);
    await ejecutarBusquedaPorCategoria(1, "Cañas de Pesca", true);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function verificarSaludBackend() {
    try {
        const res = await fetch("/health");
        const data = await res.json();
        const el = document.getElementById("estadoSaludBackend");
        if (el) el.textContent = `Activo (${data.arquitectura} · Sprint ${data.sprint})`;
    } catch {
        const el = document.getElementById("estadoSaludBackend");
        if (el) el.textContent = "Sin conexión";
    }
}

// --- Etiquetas, Autocompletado y Búsqueda ---
async function recargarCatalogoGlobalEtiquetas() {
    const resEtiq = await fetch("/api/v1/catalogo/etiquetas");
    const dataEtiq = await resEtiq.json();
    catalogoGlobalEtiquetas = dataEtiq.etiquetas || [];

    const menuEtiq = document.getElementById("menuDesplegableEtiquetas");
    if (menuEtiq) {
        menuEtiq.innerHTML = catalogoGlobalEtiquetas.map(e => `
            <a href="javascript:void(0)" onclick="buscarTerminoRapido('${e.nombre_etiqueta}')">
                🏷️ ${e.nombre_etiqueta} <small style="color:#64748b;">(${e.tipo_etiqueta})</small>
            </a>
        `).join("");
    }

    const barraHero = document.getElementById("barraEtiquetasRapidasHero");
    if (barraHero) {
        barraHero.innerHTML = `<span>🏷️ Buscar por etiqueta:</span>` +
            catalogoGlobalEtiquetas.map(e => `
                <button onclick="buscarTerminoRapido('${e.nombre_etiqueta}')">${e.nombre_etiqueta}</button>
            `).join("");
    }
}

async function manejarAutocompletado(texto) {
    const lista = document.getElementById("listaAutocompletado");
    const q = texto.trim();
    if (q.length < 3) {
        lista.classList.add("hidden");
        return;
    }
    const res = await fetch(`/api/v1/busqueda/autocompletar?q=${encodeURIComponent(q)}`);
    if (res.status === 503) return verificarBloqueoMantenimientoInicial();
    const data = await res.json();

    if (!data.Autocompletado_activo || data.sugerencias.length === 0) {
        lista.classList.add("hidden");
        return;
    }
    lista.innerHTML = data.sugerencias
        .map(item => `<li onclick="seleccionarSugerencia('${item.replace(/'/g, "\\'")}')">${item}</li>`)
        .join("");
    lista.classList.remove("hidden");
}

function seleccionarSugerencia(texto) {
    document.getElementById("inputBusqueda").value = texto.replace("🏷️ Etiqueta:", "").trim();
    document.getElementById("listaAutocompletado").classList.add("hidden");
    ejecutarBusquedaTexto();
}

function buscarTerminoRapido(termino) {
    document.getElementById("inputBusqueda").value = termino;
    ejecutarBusquedaTexto();
}

async function ejecutarBusquedaTexto() {
    const q = document.getElementById("inputBusqueda").value.replace("🏷️ Etiqueta:", "").trim();
    document.getElementById("listaAutocompletado").classList.add("hidden");
    if (!q) return limpiarBusquedaUI();

    const res = await fetch(`/api/v1/busqueda/texto?q=${encodeURIComponent(q)}`);
    if (res.status === 503) return verificarBloqueoMantenimientoInicial();
    const data = await res.json();

    document.getElementById("tituloResultados").textContent = `🔎 Resultados para: "${data.termino_buscado}"`;
    document.getElementById("btnVolverCategorias").classList.remove("hidden");
    document.getElementById("contenedorSubcategorias").classList.add("hidden");

    if (!data.tuvo_resultados) {
        productosEnPantalla = [];
        document.getElementById("grillaProductos").innerHTML = "";
        document.getElementById("contadorResultados").textContent = "0 artículos";
        document.getElementById("alertaSinResultados").classList.remove("hidden");
        document.getElementById("categoriasSugeridasCA003").innerHTML = data.categorias_sugeridas
            .map(c => crearBotonCategoriaHTML(c, false)).join("");
        return;
    }

    document.getElementById("alertaSinResultados").classList.add("hidden");
    productosEnPantalla = data.resultados;
    aplicarOrdenYFiltroLocal();
}

async function limpiarBusquedaUI() {
    await regresarPaginaInicial();
}

// --- Categorías y Productos ---
function crearBotonCategoriaHTML(cat, seleccionada) {
    const icono = ICONOS_CATEGORIA[cat.id_categoria] || "🎣";
    return `
        <button class="cat-tile ${seleccionada ? 'selected' : ''}"
                data-scrum="US002 / CA005 · Selección de categoría principal (${cat.nombre})"
                onclick="ejecutarBusquedaPorCategoria(${cat.id_categoria}, '${cat.nombre}')">
            <span class="cat-icon">${icono}</span>
            <div>
                <strong>${cat.nombre}</strong>
                <span>${cat.descripcion || ""}</span>
            </div>
        </button>`;
}

async function cargarCategoriasPrincipales(idActiva = null) {
    const res = await fetch("/api/v1/busqueda/categorias");
    if (res.status !== 200) return;
    const data = await res.json();
    const categorias = data.categorias_principales || [];

    document.getElementById("contenedorCategorias").innerHTML = categorias
        .map(c => crearBotonCategoriaHTML(c, idActiva === c.id_categoria)).join("");

    document.getElementById("menuDesplegableCategorias").innerHTML = categorias
        .map(c => `<a href="javascript:void(0)" onclick="ejecutarBusquedaPorCategoria(${c.id_categoria}, '${c.nombre}')">
                      ${ICONOS_CATEGORIA[c.id_categoria] || "🎣"} ${c.nombre}
                   </a>`).join("");
}

async function ejecutarBusquedaPorCategoria(idCategoria, nombreCategoria, esInicio = false) {
    const res = await fetch(`/api/v1/busqueda/categorias/${idCategoria}/productos`);
    if (res.status === 503) return verificarBloqueoMantenimientoInicial();
    const data = await res.json();

    document.getElementById("alertaSinResultados").classList.add("hidden");
    document.getElementById("tituloResultados").textContent = `📂 Equipos en: ${nombreCategoria}`;
    if (!esInicio) document.getElementById("btnVolverCategorias").classList.remove("hidden");
    if (idCategoria <= 5) cargarCategoriasPrincipales(idCategoria);

    const subBar = document.getElementById("contenedorSubcategorias");
    if (data.subcategorias_disponibles && data.subcategorias_disponibles.length > 0) {
        subBar.innerHTML = `<strong>🌊 Filtrar por subcategoría:</strong>` +
            data.subcategorias_disponibles.map(sub => `
                <button class="btn btn-outline-teal" onclick="ejecutarBusquedaPorCategoria(${sub.id_categoria}, '${sub.nombre}')">
                    ${ICONOS_CATEGORIA[sub.id_categoria] || "🔹"} ${sub.nombre}
                </button>`).join("");
        subBar.classList.remove("hidden");
    }

    productosEnPantalla = data.productos || [];
    aplicarOrdenYFiltroLocal();
}

async function volverMenuCategoriasUI() {
    await fetch("/api/v1/busqueda/categorias/volver", { method: "POST" });
    document.getElementById("contenedorSubcategorias").classList.add("hidden");
    document.getElementById("btnVolverCategorias").classList.add("hidden");
    await cargarCategoriasPrincipales(1);
    await ejecutarBusquedaPorCategoria(1, "Cañas de Pesca", true);
}

// --- Filtros Técnicos en Fila (US003) ---
async function cargarOpcionesFiltrosSprint2() {
    const res = await fetch("/api/v1/busqueda/filtros/opciones");
    if (res.status !== 200) return;
    const data = await res.json();

    document.getElementById("filtroMarca").innerHTML = `<option value="">Todas las marcas</option>` +
        data.marcas.map(m => `<option value="${m}">${m}</option>`).join("");
    document.getElementById("filtroPotencia").innerHTML = `<option value="">Toda potencia</option>` +
        data.potencias.map(p => `<option value="${p}">${p}</option>`).join("");
}

async function ejecutarFiltrosTecnicosUI() {
    const payload = {
        termino: document.getElementById("inputBusqueda").value.trim(),
        marca: document.getElementById("filtroMarca").value,
        potencia: document.getElementById("filtroPotencia").value,
        resistencia_min_lb: document.getElementById("filtroResistenciaMin").value,
        peso_max_gr: document.getElementById("filtroPesoMax").value,
        precio_max: document.getElementById("filtroPrecioMax").value
    };

    const res = await fetch("/api/v1/busqueda/filtros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (res.status === 503) return verificarBloqueoMantenimientoInicial();

    const data = await res.json();
    document.getElementById("tituloResultados").textContent = "🎛️ Resultados con Filtros Técnicos";

    if (!data.tuvo_resultados) {
        productosEnPantalla = [];
        document.getElementById("grillaProductos").innerHTML = `
            <div class="no-results-box" style="grid-column:1/-1;">
                <h3>${data.mensaje}</h3>
                <button class="btn btn-ocean" style="margin-top:0.8rem;" onclick="restablecerFiltrosTecnicosUI()">
                    🔄 Restablecer Filtros
                </button>
            </div>`;
        document.getElementById("contadorResultados").textContent = "0 artículos";
        return;
    }

    document.getElementById("alertaSinResultados").classList.add("hidden");
    productosEnPantalla = data.resultados;
    aplicarOrdenYFiltroLocal();
}

function restablecerFiltrosTecnicosUI() {
    document.getElementById("filtroMarca").value = "";
    document.getElementById("filtroPotencia").value = "";
    document.getElementById("filtroResistenciaMin").value = "";
    document.getElementById("filtroPesoMax").value = "";
    document.getElementById("filtroPrecioMax").value = "";
    regresarPaginaInicial();
}

// --- Ordenamiento y Renderizado ---
function aplicarOrdenYFiltroLocal() {
    const soloDisponibles = document.getElementById("chkSoloDisponibles").checked;
    const criterioOrden = document.getElementById("selectOrdenCatalogo").value;
    let lista = [...productosEnPantalla];

    if (soloDisponibles) lista = lista.filter(p => p.stock_actual > 0);

    lista.sort((a, b) => {
        const precioA = a.precio_vigente !== undefined ? a.precio_vigente : a.precio;
        const precioB = b.precio_vigente !== undefined ? b.precio_vigente : b.precio;
        if (criterioOrden === "precio_asc") return precioA - precioB;
        if (criterioOrden === "precio_desc") return precioB - precioA;
        if (criterioOrden === "stock_desc") return b.stock_actual - a.stock_actual;
        if (criterioOrden === "nombre_asc") return a.nombre.localeCompare(b.nombre);
        return 0;
    });

    renderizarProductos(lista);
}

function renderizarProductos(productos) {
    const grilla = document.getElementById("grillaProductos");
    document.getElementById("contadorResultados").textContent = `${productos.length} artículo(s)`;

    if (productos.length === 0) {
        grilla.innerHTML = `<p style="color:#64748b; padding:1rem 0;">No hay artículos disponibles en esta vista.</p>`;
        return;
    }

    grilla.innerHTML = productos.map(p => {
        const precioVigente = (p.precio_vigente !== undefined ? p.precio_vigente : p.precio).toFixed(2);
        const tienePromo = p.en_promocion && p.precio_regular !== undefined;
        const disponible = p.stock_actual > 0;
        const urlImg = p.url_imagen || "/static/img/default_no_image.jpg";
        const iconoCat = ICONOS_CATEGORIA[p.id_categoria] || "🎣";

        return `
            <article class="product-item-card">
                <div>
                    <div class="product-thumb-container" onclick="abrirFichaTecnica(${p.id_producto})" style="cursor:pointer;">
                        <img src="${urlImg}" alt="${p.nombre}"
                             onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                        <div class="thumb-fallback hidden">
                            <span style="font-size:2.2rem;">${iconoCat}</span>
                            <strong>${p.marca}</strong>
                        </div>
                    </div>
                    <div class="product-card-top">
                        <span class="brand-badge">${p.marca}</span>
                        <span class="sku-code">SKU: ${p.sku}</span>
                    </div>
                    <h3 class="product-title">${p.nombre}</h3>
                    <span class="stock-badge ${disponible ? 'stock-verde' : 'stock-rojo'}">
                        ${disponible ? `● Disponible (${p.stock_actual} unid.)` : `● Agotado`}
                    </span>
                </div>
                <div>
                    <div class="product-price-row">
                        <span style="font-size:0.8rem; color:#64748b;">Precio caja:</span>
                        <div>
                            ${tienePromo ? `<span class="price-old-strike">S/ ${p.precio_regular.toFixed(2)}</span>` : ""}
                            <span class="price-value">S/ ${precioVigente}</span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-sand" onclick="abrirFichaTecnica(${p.id_producto})">📋 Ver Ficha</button>
                        <button class="btn btn-ocean" ${!disponible ? "disabled" : ""}
                                onclick="alert('Artículo disponible en inventario.')">
                            ${disponible ? "➕ Seleccionar" : "🚫 Sin Stock"}
                        </button>
                    </div>
                </div>
            </article>`;
    }).join("");
}

// --- Modal Ficha Técnica + Explicación IA (US005) ---
async function abrirFichaTecnica(idProducto) {
    const res = await fetch(`/api/v1/catalogo/productos/${idProducto}/ficha`);
    const f = await res.json();

    document.getElementById("modalCategoriaBadge").textContent = `${f.marca} · ${f.categoria}`;
    document.getElementById("modalTituloProducto").textContent = f.nombre;

    const imgPrincipal = f.galeria_imagenes[0];
    const etiquetasHTML = f.etiquetas && f.etiquetas.length > 0
        ? f.etiquetas.map(e => `<span class="tag-badge" style="cursor:pointer;" onclick="cerrarModalFicha(); buscarTerminoRapido('${e.nombre_etiqueta}')">🏷️ ${e.nombre_etiqueta}</span>`).join("")
        : `<span style="color:#64748b; font-size:0.85rem;">Sin etiquetas asociadas</span>`;

    document.getElementById("modalCuerpoProducto").innerHTML = `
        <div class="modal-image-showcase">
            <img src="${imgPrincipal.url_imagen}" alt="${f.nombre}"
                 onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
            <div class="thumb-fallback hidden" style="padding:1.5rem;">
                <span style="font-size:3rem;">${ICONOS_CATEGORIA[f.id_categoria] || "🎣"}</span>
                <strong>${f.marca} - ${f.categoria}</strong>
            </div>
        </div>
        <p style="margin-bottom:0.85rem; line-height:1.5;">${f.descripcion_tecnica}</p>
        <div style="margin-bottom:1rem;">
            <button class="btn btn-ocean" onclick="solicitarExplicacionIA(${f.id_producto})">
                🤖 ¿Para qué sirve? (Explicación Técnica IA)
            </button>
            <div id="contenedorExplicacionIA"></div>
        </div>
        <table class="specs-grid-table">
            <tr><th>Código SKU</th><td><code>${f.sku}</code></td></tr>
            <tr><th>Resistencia de Línea</th><td>${f.especificaciones.resistencia_min_lb ?? '-'} a ${f.especificaciones.resistencia_max_lb ?? '-'} lb</td></tr>
            <tr><th>Peso / Potencia</th><td>${f.especificaciones.peso_gr ?? '-'} g · ${f.especificaciones.potencia ?? 'Estándar'}</td></tr>
            <tr><th>Entorno</th><td>${f.especificaciones.entorno_recomendado ?? 'General'}</td></tr>
        </table>
        <div class="tags-cloud" style="margin-top:0.85rem;">${etiquetasHTML}</div>
    `;
    document.getElementById("modalFicha").classList.remove("hidden");
}

function cerrarModalFicha() {
    document.getElementById("modalFicha").classList.add("hidden");
}

async function solicitarExplicacionIA(idProducto) {
    const cont = document.getElementById("contenedorExplicacionIA");
    const res = await fetch(`/api/v1/asesor/productos/${idProducto}/explicacion`);
    if (res.status === 503) return verificarBloqueoMantenimientoInicial();
    const data = await res.json();

    cont.innerHTML = `
        <div class="coupon-rule-banner" style="margin-top:0.75rem;">
            <strong>🤖 Asesor Técnico IA (${data.modalidad_recomendada}):</strong>
            <p style="margin:0.4rem 0; color:#0f172a;">${data.resumen_legible}</p>
            <ul style="margin-left:1.2rem; font-size:0.84rem;">
                ${data.ventajas_clave.map(v => `<li>${v}</li>`).join("")}
            </ul>
        </div>`;
}

// --- Modal Visión Artificial (US004) ---
function abrirModalVisionIA() {
    document.getElementById("resultadoVisionIA").innerHTML = "";
    document.getElementById("inputArchivoVisionIA").value = "";
    document.getElementById("modalVisionIA").classList.remove("hidden");
}

function cerrarModalVisionIA() {
    document.getElementById("modalVisionIA").classList.add("hidden");
}

async function procesarImagenVisionIA() {
    const input = document.getElementById("inputArchivoVisionIA");
    const box = document.getElementById("resultadoVisionIA");
    if (!input.files || !input.files[0]) {
        box.innerHTML = `<p style="color:#b91c1c;">⚠️ Selecciona primero una imagen.</p>`;
        return;
    }

    const formData = new FormData();
    formData.append("imagen", input.files[0]);
    const res = await fetch("/api/v1/busqueda/imagen", { method: "POST", body: formData });
    if (res.status === 503) {
        cerrarModalVisionIA();
        return verificarBloqueoMantenimientoInicial();
    }
    const data = await res.json();

    if (!data.identificado) {
        box.innerHTML = `
            <div class="stock-badge stock-rojo">⚠️ Confianza: ${data.confianza}% (Mínimo ${data.umbral_requerido}%)</div>
            <p style="margin-top:0.5rem;"><strong>${data.mensaje}</strong></p>`;
        return;
    }

    const principal = data.coincidencias[0];
    box.innerHTML = `
        <div class="coupon-rule-banner">
            <strong>✅ Clase detectada:</strong> ${data.clase_detectada} · <strong>Confianza:</strong> ${data.confianza}%
        </div>
        <div style="margin-top:0.75rem; padding:0.85rem; border:1px solid #dbe3ec; border-radius:10px;">
            <strong>${principal.nombre}</strong> (<code>${principal.sku}</code>) ·
            <strong>${principal.estado_stock}</strong> (${principal.stock_actual} unid.)<br>
            <button class="btn btn-ocean" style="margin-top:0.5rem;" onclick="cerrarModalVisionIA(); abrirFichaTecnica(${principal.id_producto})">
                📋 Ver Ficha
            </button>
        </div>`;
}

// --- Bloqueo por Mantenimiento (US017) ---
async function verificarBloqueoMantenimientoInicial() {
    const res = await fetch("/api/v1/admin/mantenimiento");
    const data = await res.json();
    const overlay = document.getElementById("overlayMantenimiento");
    if (data.modo_mantenimiento) {
        document.getElementById("textoBloqueoMantenimiento").textContent = data.mensaje_mantenimiento;
        overlay.classList.remove("hidden");
    } else {
        overlay.classList.add("hidden");
    }
}

async function desbloquearDesdeOverlay() {
    const pin = document.getElementById("inputPinDesbloqueoOverlay").value;
    const err = document.getElementById("errorDesbloqueoOverlay");
    const res = await fetch("/api/v1/admin/mantenimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activar: false, pin })
    });
    const data = await res.json();
    if (!data.autorizado) {
        err.textContent = data.mensaje;
        return;
    }
    err.textContent = "";
    document.getElementById("inputPinDesbloqueoOverlay").value = "";
    await verificarBloqueoMantenimientoInicial();
    await regresarPaginaInicial();
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
