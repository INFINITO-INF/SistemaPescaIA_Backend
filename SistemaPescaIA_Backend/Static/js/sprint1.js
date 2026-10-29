let productosEnPantalla = [];
let todosLosProductosAuditoria = [];
let arbolMarcasCatalogo = {};
let catalogoGlobalEtiquetas = [];
let catalogoCupones = [];
let borradorEtiquetasModal = [];
let productoActualModal = null;

const ICONOS_CATEGORIA = {
    1: "🎣",
    2: "⚙️",
    3: "🐟",
    4: "🧵",
    5: "🪝",
    6: "🏞️",
    7: "🌊"
};

document.addEventListener("DOMContentLoaded", async () => {
    inicializarTooltipsScrumConRetraso();
    verificarSaludBackend();
    await recargarCatalogoGlobalEtiquetas();
    await cargarCategoriasPrincipales(1);
    await ejecutarBusquedaPorCategoria(1, "Cañas de Pesca", true);
    await inicializarDatosPanelAdmin();
});

// =========================================================================
// 1. TOOLTIPS SCRUM CON RETRASO DE 1.2 SEGUNDOS
// =========================================================================
function inicializarTooltipsScrumConRetraso() {
    const tooltip = document.getElementById("scrumDelayedTooltip");
    let temporizadorHover = null;
    let ultimoElemento = null;
    let mouseX = 0;
    let mouseY = 0;

    document.addEventListener("mouseover", (e) => {
        const objetivo = e.target.closest("[data-scrum]");
        if (!objetivo) return;

        ultimoElemento = objetivo;
        clearTimeout(temporizadorHover);

        temporizadorHover = setTimeout(() => {
            if (ultimoElemento === objetivo) {
                const codigoScrum = objetivo.getAttribute("data-scrum");
                tooltip.textContent = `🏷️ ${codigoScrum}`;
                tooltip.style.left = `${Math.min(mouseX + 14, window.innerWidth - 330)}px`;
                tooltip.style.top = `${Math.min(mouseY + 18, window.innerHeight - 60)}px`;
                tooltip.classList.remove("hidden");
            }
        }, 1200);
    });

    document.addEventListener("mousemove", (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!tooltip.classList.contains("hidden")) {
            tooltip.classList.add("hidden");
            clearTimeout(temporizadorHover);
        }
    });

    document.addEventListener("mouseout", (e) => {
        const objetivo = e.target.closest("[data-scrum]");
        if (objetivo) {
            clearTimeout(temporizadorHover);
            tooltip.classList.add("hidden");
            ultimoElemento = null;
        }
    });
}

// =========================================================================
// 2. HEADER: RETORNO AL INICIO E ÍCONO DE ADMINISTRADOR
// =========================================================================
async function regresarPaginaInicial() {
    await fetch("/api/v1/busqueda/limpiar", { method: "POST" });
    await fetch("/api/v1/busqueda/categorias/volver", { method: "POST" });

    cambiarVista("cliente");
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

function alternarPanelAdmin() {
    const vAdmin = document.getElementById("vistaAdmin");
    const estaEnAdmin = !vAdmin.classList.contains("hidden");
    cambiarVista(estaEnAdmin ? "cliente" : "admin");
}

function cambiarVista(vista) {
    const vCliente = document.getElementById("vistaCliente");
    const vAdmin = document.getElementById("vistaAdmin");
    const btnIcono = document.getElementById("btnIconoAdmin");

    if (vista === "cliente") {
        vCliente.classList.remove("hidden");
        vAdmin.classList.add("hidden");
        btnIcono.classList.remove("active");
    } else {
        vCliente.classList.add("hidden");
        vAdmin.classList.remove("hidden");
        btnIcono.classList.add("active");
        cargarDatosAuditoriaYCupones();
        mostrarResumenEtiquetasProducto();
    }
}

async function verificarSaludBackend() {
    try {
        const res = await fetch("/health");
        const data = await res.json();
        document.getElementById("estadoSaludBackend").textContent =
            `Activo (${data.arquitectura} · Sprint ${data.sprint})`;
    } catch {
        document.getElementById("estadoSaludBackend").textContent = "Sin conexión";
    }
}

// =========================================================================
// 3. BÚSQUEDA POR TEXTO, SKU O ETIQUETA TÉCNICA (US001 & US009)
// =========================================================================
async function recargarCatalogoGlobalEtiquetas() {
    const resEtiq = await fetch("/api/v1/catalogo/etiquetas");
    const dataEtiq = await resEtiq.json();
    catalogoGlobalEtiquetas = dataEtiq.etiquetas || [];

    // Actualizar menú desplegable de etiquetas en el Header
    const menuEtiq = document.getElementById("menuDesplegableEtiquetas");
    if (menuEtiq) {
        menuEtiq.innerHTML = catalogoGlobalEtiquetas.map(e => `
            <a href="javascript:void(0)" onclick="buscarTerminoRapido('${e.nombre_etiqueta}')">
                🏷️ ${e.nombre_etiqueta} <small style="color:#64748b;">(${e.tipo_etiqueta})</small>
            </a>
        `).join("");
    }

    // Actualizar píldoras de etiquetas rápidas bajo el buscador principal
    const barraHero = document.getElementById("barraEtiquetasRapidasHero");
    if (barraHero) {
        barraHero.innerHTML = `<span>🏷️ Buscar por etiqueta:</span>` +
            catalogoGlobalEtiquetas.map(e => `
                <button onclick="buscarTerminoRapido('${e.nombre_etiqueta}')">
                    ${e.nombre_etiqueta}
                </button>
            `).join("");
    }
}

async function manejarAutocompletado(texto) {
    const lista = document.getElementById("listaAutocompletado");
    const q = texto.trim();

    if (q.length < 3) {
        lista.classList.add("hidden");
        lista.innerHTML = "";
        return;
    }

    const res = await fetch(`/api/v1/busqueda/autocompletar?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!data.Autocompletado_activo || data.sugerencias.length === 0) {
        lista.classList.add("hidden");
        return;
    }

    lista.innerHTML = data.sugerencias
        .map(item => `<li data-scrum="US001 / CA002 · Sugerencia automática de producto o etiqueta"
                          onclick="seleccionarSugerencia('${item.replace(/'/g, "\\'")}')">${item}</li>`)
        .join("");
    lista.classList.remove("hidden");
}

function seleccionarSugerencia(texto) {
    const limpio = texto.replace("🏷️ Etiqueta:", "").trim();
    document.getElementById("inputBusqueda").value = limpio;
    document.getElementById("listaAutocompletado").classList.add("hidden");
    ejecutarBusquedaTexto();
}

function buscarTerminoRapido(termino) {
    cambiarVista("cliente");
    document.getElementById("inputBusqueda").value = termino;
    ejecutarBusquedaTexto();
}

async function ejecutarBusquedaTexto() {
    const input = document.getElementById("inputBusqueda");
    const q = input.value.replace("🏷️ Etiqueta:", "").trim();
    document.getElementById("listaAutocompletado").classList.add("hidden");

    if (!q) {
        limpiarBusquedaUI();
        return;
    }

    const res = await fetch(`/api/v1/busqueda/texto?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    document.getElementById("tituloResultados").textContent = `🔎 Resultados para producto o etiqueta: "${data.termino_buscado}"`;
    document.getElementById("btnVolverCategorias").classList.remove("hidden");
    document.getElementById("contenedorSubcategorias").classList.add("hidden");

    if (!data.tuvo_resultados) {
        productosEnPantalla = [];
        document.getElementById("grillaProductos").innerHTML = "";
        document.getElementById("contadorResultados").textContent = "0 artículos";

        const alerta = document.getElementById("alertaSinResultados");
        alerta.classList.remove("hidden");

        document.getElementById("categoriasSugeridasCA003").innerHTML = data.categorias_sugeridas
            .map(c => crearBotonCategoriaHTML(c, false))
            .join("");
        return;
    }

    document.getElementById("alertaSinResultados").classList.add("hidden");
    productosEnPantalla = data.resultados;
    aplicarOrdenYFiltroLocal();
}

async function limpiarBusquedaUI() {
    await regresarPaginaInicial();
}

// =========================================================================
// 4. CATEGORÍAS Y TARJETAS DE PRODUCTOS CON IMAGEN DE GRUPO
// =========================================================================
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
        </button>
    `;
}

async function cargarCategoriasPrincipales(idActiva = null) {
    const res = await fetch("/api/v1/busqueda/categorias");
    const data = await res.json();
    const categorias = data.categorias_principales || [];

    document.getElementById("contenedorCategorias").innerHTML = categorias
        .map(c => crearBotonCategoriaHTML(c, idActiva === c.id_categoria))
        .join("");

    document.getElementById("menuDesplegableCategorias").innerHTML = categorias
        .map(c => `<a href="javascript:void(0)"
                      onclick="cambiarVista('cliente'); ejecutarBusquedaPorCategoria(${c.id_categoria}, '${c.nombre}')">
                      ${ICONOS_CATEGORIA[c.id_categoria] || "🎣"} ${c.nombre}
                   </a>`)
        .join("");
}

async function ejecutarBusquedaPorCategoria(idCategoria, nombreCategoria, esInicio = false) {
    const res = await fetch(`/api/v1/busqueda/categorias/${idCategoria}/productos`);
    const data = await res.json();

    document.getElementById("alertaSinResultados").classList.add("hidden");
    document.getElementById("tituloResultados").textContent = `📂 Equipos en: ${nombreCategoria}`;

    if (!esInicio) {
        document.getElementById("btnVolverCategorias").classList.remove("hidden");
    }

    if (idCategoria <= 5) {
        cargarCategoriasPrincipales(idCategoria);
    }

    const subBar = document.getElementById("contenedorSubcategorias");
    if (data.subcategorias_disponibles && data.subcategorias_disponibles.length > 0) {
        subBar.innerHTML = `
            <strong>🌊 Filtrar por subcategoría:</strong>
            ${data.subcategorias_disponibles.map(sub => `
                <button class="btn btn-outline-teal"
                        data-scrum="US002 / CA006 · Filtro por subcategoría (${sub.nombre})"
                        onclick="ejecutarBusquedaPorCategoria(${sub.id_categoria}, '${sub.nombre}')">
                    ${ICONOS_CATEGORIA[sub.id_categoria] || "🔹"} ${sub.nombre}
                </button>
            `).join("")}
        `;
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

function aplicarOrdenYFiltroLocal() {
    const soloDisponibles = document.getElementById("chkSoloDisponibles").checked;
    const criterioOrden = document.getElementById("selectOrdenCatalogo").value;

    let lista = [...productosEnPantalla];

    if (soloDisponibles) {
        lista = lista.filter(p => p.stock_actual > 0);
    }

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
        const claseStock = disponible ? "stock-verde" : "stock-rojo";
        const textoStock = disponible
            ? `● Disponible en tienda (${p.stock_actual} unid.)`
            : `● Agotado en tienda`;

        const urlImg = p.url_imagen || "/static/img/default_no_image.jpg";
        const iconoCat = ICONOS_CATEGORIA[p.id_categoria] || "🎣";

        return `
            <article class="product-item-card">
                <div>
                    <!-- Imagen compartida del Grupo (Marca + Categoría) -->
                    <div class="product-thumb-container" onclick="abrirFichaTecnica(${p.id_producto})" style="cursor:pointer;">
                        <img src="${urlImg}" alt="${p.marca} - ${p.nombre}"
                             onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                        <div class="thumb-fallback hidden">
                            <span style="font-size:2.2rem;">${iconoCat}</span>
                            <strong>Imagen Grupal: ${p.marca}</strong>
                            <small><code>${urlImg}</code></small>
                        </div>
                    </div>

                    <div class="product-card-top">
                        <span class="brand-badge">${p.marca}</span>
                        <span class="sku-code">SKU: ${p.sku}</span>
                    </div>
                    <h3 class="product-title">${p.nombre}</h3>
                    <span class="stock-badge ${claseStock}"
                          data-scrum="${disponible ? 'US010 / CA024 · Producto con stock disponible' : 'US010 / CA025 · Producto agotado'}">
                        ${textoStock}
                    </span>
                </div>

                <div>
                    <div class="product-price-row">
                        <span style="font-size:0.8rem; color:#64748b;">Precio vigente caja:</span>
                        <div>
                            ${tienePromo ? `<span class="price-old-strike">S/ ${p.precio_regular.toFixed(2)}</span>` : ""}
                            <span class="price-value">S/ ${precioVigente}</span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-sand" onclick="abrirFichaTecnica(${p.id_producto})"
                                data-scrum="US011 / CA027 · Consultar ficha técnica e imagen grupal">
                            📋 Ver Ficha
                        </button>
                        <button class="btn btn-ocean" ${!disponible ? "disabled" : ""}
                                onclick="alert('Artículo disponible en inventario.')">
                            ${disponible ? "➕ Seleccionar" : "🚫 Sin Stock"}
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

// =========================================================================
// 5. MODAL DE FICHA TÉCNICA CON VISUALIZACIÓN DE IMAGEN DE GRUPO
// =========================================================================
async function abrirFichaTecnica(idProducto) {
    const res = await fetch(`/api/v1/catalogo/productos/${idProducto}/ficha`);
    const f = await res.json();

    document.getElementById("modalCategoriaBadge").textContent = `${f.marca} · ${f.categoria}`;
    document.getElementById("modalTituloProducto").textContent = f.nombre;

    const imgPrincipal = f.galeria_imagenes[0];
    const bannerImagen = imgPrincipal.es_default
        ? `<div class="stock-badge stock-rojo" style="margin-bottom:0.65rem;"
                data-scrum="US011 / CA028 · Producto sin imagen de grupo ni individual usa imagen por defecto">
                🖼️ ${imgPrincipal.leyenda}
           </div>`
        : `<div class="stock-badge stock-verde" style="margin-bottom:0.65rem;"
                data-scrum="US011 / CA027 · Imagen heredada del grupo (${f.marca} - ${f.categoria})">
                📸 Imagen asociada al grupo: ${f.marca} · ${f.categoria} (${imgPrincipal.resolucion})
           </div>`;

    const etiquetasHTML = f.etiquetas && f.etiquetas.length > 0
        ? f.etiquetas.map(e => `
            <span class="tag-badge" style="cursor:pointer;"
                  onclick="cerrarModalFicha(); buscarTerminoRapido('${e.nombre_etiqueta}')">
                🏷️ ${e.nombre_etiqueta} (${e.tipo_etiqueta})
            </span>`).join("")
        : `<span style="color:#64748b; font-size:0.85rem;">Sin etiquetas técnicas asociadas</span>`;

    const tienePromo = f.precio_vigente < f.precio_unitario;

    document.getElementById("modalCuerpoProducto").innerHTML = `
        ${bannerImagen}

        <div class="modal-image-showcase">
            <img src="${imgPrincipal.url_imagen}" alt="${f.nombre}"
                 onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
            <div class="thumb-fallback hidden" style="padding:1.5rem;">
                <span style="font-size:3rem;">${ICONOS_CATEGORIA[f.id_categoria] || "🎣"}</span>
                <strong>Vista Grupal: ${f.marca} - ${f.categoria}</strong>
                <small>Coloca tu imagen descargada en: <code>${imgPrincipal.url_imagen}</code></small>
            </div>
        </div>

        <p style="font-size:0.84rem; color:#475569; margin-bottom:0.65rem;">
            <strong>Código SKU Único:</strong> <code>${f.sku}</code> &nbsp;|&nbsp;
            <strong>Ruta en SQL Server:</strong> <code>${imgPrincipal.url_imagen}</code>
        </p>
        <p style="margin-bottom:1rem; line-height:1.5;">${f.descripcion_tecnica}</p>

        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:0.9rem 1rem; border-radius:10px; border:1px solid #dbe3ec;">
            <div>
                <strong style="display:block; font-size:0.82rem; color:#475569;">DISPONIBILIDAD EN TIENDA:</strong>
                <span class="stock-badge ${f.inventario.indicador_color === 'verde' ? 'stock-verde' : 'stock-rojo'}">
                    ${f.inventario.leyenda} (${f.inventario.stock_actual} unidades)
                </span>
            </div>
            <div style="text-align:right;">
                ${tienePromo ? `<small style="text-decoration:line-through; color:#94a3b8;">Regular: S/ ${f.precio_unitario.toFixed(2)}</small><br>` : ""}
                <span class="price-value">S/ ${f.precio_vigente.toFixed(2)}</span>
            </div>
        </div>

        <h4 style="margin-top:1.2rem; color:#0b2540;">Especificaciones Técnicas:</h4>
        <table class="specs-grid-table">
            <tr><th>Resistencia de Línea</th><td>${f.especificaciones.resistencia_min_lb ?? '-'} lb a ${f.especificaciones.resistencia_max_lb ?? '-'} lb</td></tr>
            <tr><th>Peso del Artículo</th><td>${f.especificaciones.peso_gr ?? '-'} gramos</td></tr>
            <tr><th>Potencia / Acción</th><td>${f.especificaciones.potencia ?? 'Estándar'} / ${f.especificaciones.accion ?? 'Estándar'}</td></tr>
            <tr><th>Entorno Recomendado</th><td>${f.especificaciones.entorno_recomendado ?? 'General'}</td></tr>
        </table>

        <h4 style="margin-top:1.2rem; color:#0b2540;">Etiquetas Técnicas (Haz clic en una para buscar similares):</h4>
        <div class="tags-cloud" style="margin-top:0.45rem;">${etiquetasHTML}</div>
    `;

    document.getElementById("modalFicha").classList.remove("hidden");
}

function cerrarModalFicha() {
    document.getElementById("modalFicha").classList.add("hidden");
}

// =========================================================================
// 6. PANEL ADMIN: ETIQUETADO IA, CREACIÓN MANUAL Y MODAL FLOTANTE
// =========================================================================
async function inicializarDatosPanelAdmin() {
    await cargarDatosAuditoriaYCupones();
    await mostrarResumenEtiquetasProducto();
}

async function sugerirEtiquetasIA() {
    const descripcion = document.getElementById("txtDescripcionIA").value.trim();
    const cont = document.getElementById("resultadoSugerenciasIA");

    if (!descripcion) {
        cont.innerHTML = `<span style="color:#b91c1c; font-size:0.85rem;">Escribe primero una descripción técnica para analizarla.</span>`;
        return;
    }

    const res = await fetch("/api/v1/catalogo/etiquetas/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion_tecnica: descripcion })
    });
    const data = await res.json();

    if (!data.sugerencias || data.sugerencias.length === 0) {
        cont.innerHTML = `<span style="color:#64748b; font-size:0.85rem;">No se detectaron etiquetas predefinidas.</span>`;
        return;
    }

    cont.innerHTML = data.sugerencias
        .map(s => `<span class="tag-badge">✨ ${s.nombre_etiqueta} (${s.tipo_etiqueta})</span>`)
        .join("");
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
        feedback.textContent = "⚠️ Ingresa un nombre para la etiqueta.";
        return;
    }

    const res = await fetch("/api/v1/catalogo/etiquetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nombre_etiqueta: nombre,
            tipo_etiqueta: selectTipo.value
        })
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
    if (!ficha.etiquetas || ficha.etiquetas.length === 0) {
        cont.innerHTML = `<span style="color:#64748b; font-size:0.85rem;">Este producto aún no tiene etiquetas técnicas vinculadas.</span>`;
        return;
    }

    cont.innerHTML = ficha.etiquetas
        .map(e => `<span class="tag-badge">${e.nombre_etiqueta} <small>(${e.tipo_etiqueta})</small></span>`)
        .join("");
}

async function abrirModalGestionEtiquetas() {
    await recargarCatalogoGlobalEtiquetas();
    await mostrarResumenEtiquetasProducto();
    if (!productoActualModal) return;

    borradorEtiquetasModal = [...(productoActualModal.etiquetas || [])];
    document.getElementById("tituloModalEtiquetas").textContent = `Etiquetas de: ${productoActualModal.nombre}`;
    document.getElementById("subtituloModalEtiquetas").textContent =
        `SKU: ${productoActualModal.sku} · Marca: ${productoActualModal.marca} · Categoría: ${productoActualModal.categoria}`;

    renderizarEditorEtiquetasModal();
    document.getElementById("modalGestionEtiquetas").classList.remove("hidden");
}

function renderizarEditorEtiquetasModal() {
    const cajaChips = document.getElementById("contenedorChipsEditables");
    const selectorAgregar = document.getElementById("selectAgregarEtiquetaModal");

    if (borradorEtiquetasModal.length === 0) {
        cajaChips.innerHTML = `<span style="color:#64748b; font-size:0.86rem;">Sin etiquetas vinculadas.</span>`;
    } else {
        cajaChips.innerHTML = borradorEtiquetasModal.map(e => `
            <span class="tag-chip-removable">
                ${e.nombre_etiqueta} <small>(${e.tipo_etiqueta})</small>
                <button type="button" title="Desvincular etiqueta"
                        onclick="quitarEtiquetaDeBorradorModal(${e.id_etiqueta})">✕</button>
            </span>
        `).join("");
    }

    const idsAsignados = new Set(borradorEtiquetasModal.map(e => e.id_etiqueta));
    const disponibles = catalogoGlobalEtiquetas.filter(e => !idsAsignados.has(e.id_etiqueta));

    selectorAgregar.innerHTML = disponibles.length === 0
        ? `<option value="">Todas las etiquetas disponibles ya están asignadas</option>`
        : disponibles.map(e => `<option value="${e.id_etiqueta}">${e.nombre_etiqueta} (${e.tipo_etiqueta})</option>`).join("");
}

function quitarEtiquetaDeBorradorModal(idEtiqueta) {
    borradorEtiquetasModal = borradorEtiquetasModal.filter(e => e.id_etiqueta !== idEtiqueta);
    renderizarEditorEtiquetasModal();
}

function agregarEtiquetaEnBorradorModal() {
    const selector = document.getElementById("selectAgregarEtiquetaModal");
    const idSeleccionado = parseInt(selector.value);
    if (!idSeleccionado) return;

    const etiquetaObj = catalogoGlobalEtiquetas.find(e => e.id_etiqueta === idSeleccionado);
    if (etiquetaObj && !borradorEtiquetasModal.some(e => e.id_etiqueta === idSeleccionado)) {
        borradorEtiquetasModal.push(etiquetaObj);
        renderizarEditorEtiquetasModal();
    }
}

function cerrarModalGestionEtiquetas() {
    borradorEtiquetasModal = [];
    document.getElementById("modalGestionEtiquetas").classList.add("hidden");
}

async function guardarCambiosEtiquetasModal() {
    if (!productoActualModal) return;
    const idsEtiquetas = borradorEtiquetasModal.map(e => e.id_etiqueta);

    await fetch(`/api/v1/catalogo/productos/${productoActualModal.id_producto}/etiquetas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids_etiquetas: idsEtiquetas })
    });

    document.getElementById("modalGestionEtiquetas").classList.add("hidden");
    await mostrarResumenEtiquetasProducto();
}

// =========================================================================
// 7. AUDITORÍA COMPLETA DE PRODUCTOS, ÁRBOL MARCA->TIPO->SKU Y CUPONES
// =========================================================================
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

    // Poblar selector de productos de la sección de etiquetas si aún está vacío
    const selProdEtiq = document.getElementById("selectProdEtiqueta");
    if (selProdEtiq && selProdEtiq.options.length === 0) {
        selProdEtiq.innerHTML = todosLosProductosAuditoria
            .map(p => `<option value="${p.id_producto}">${p.sku} · ${p.nombre}</option>`)
            .join("");
    }

    // Poblar selector de cupones
    const selCupon = document.getElementById("selectCuponActivo");
    selCupon.innerHTML = catalogoCupones.map(c => {
        const detalleValor = c.tipo_descuento === "PROMO_2X1"
            ? "2x1 -> Producto a S/ 0.00"
            : (c.tipo_descuento === "MONTO_FIJO" ? `- S/ ${c.valor_descuento.toFixed(2)}` : `- ${c.valor_descuento}%`);
        return `<option value="${c.id_cupon}">${c.codigo_cupon} · ${c.nombre_cupon} (${detalleValor})</option>`;
    }).join("");

    // Poblar selector de Marcas (Ej: Shimano, Okuma, Daiwa...)
    const selMarca = document.getElementById("selectFiltroMarca");
    const marcasDisponibles = Object.keys(arbolMarcasCatalogo);
    const marcaPrevia = selMarca.value;
    selMarca.innerHTML = marcasDisponibles.map(m => `<option value="${m}">${m}</option>`).join("");
    if (marcasDisponibles.includes(marcaPrevia)) {
        selMarca.value = marcaPrevia;
    }

    actualizarSelectorTiposPorMarca();
    renderizarTablaGeneralAuditoriaPrecios();
}

function obtenerCuponSeleccionadoObjeto() {
    const idCupon = parseInt(document.getElementById("selectCuponActivo").value);
    return catalogoCupones.find(c => c.id_cupon === idCupon) || null;
}

function esProductoElegibleParaCuponLocal(producto, cupon) {
    if (!cupon) return true;
    if (cupon.tipo_descuento === "PROMO_2X1") return true;
    if (cupon.tipo_descuento === "MONTO_FIJO") {
        // Regla estricta: un cupón de S/ 100 solo aplica a productos > S/ 100 (S/ 101 a más).
        // Productos de S/ 100 o menos quedan en gris (disabled).
        return producto.precio_unitario > cupon.valor_descuento;
    }
    return cupon.valor_descuento > 0 && cupon.valor_descuento < 100;
}

function actualizarElegibilidadProductosSegunCupon() {
    const cupon = obtenerCuponSeleccionadoObjeto();
    const banner = document.getElementById("infoReglaCuponSeleccionado");

    if (cupon) {
        const reglaTexto = cupon.tipo_descuento === "PROMO_2X1"
            ? "Promoción 2x1: Permite que el producto seleccionado llegue a S/ 0.00 sin importar su precio base."
            : (cupon.tipo_descuento === "MONTO_FIJO"
                ? `Regla de protección activa: Este cupón descuenta S/ ${cupon.valor_descuento.toFixed(2)}, por lo que los productos con precio de S/ ${cupon.valor_descuento.toFixed(2)} o menos aparecerán deshabilitados en gris.`
                : `Aplica un descuento del ${cupon.valor_descuento}% sobre el precio regular.`);

        banner.innerHTML = `<strong>${cupon.codigo_cupon}:</strong> ${cupon.descripcion_accion}<br><small>${reglaTexto}</small>`;
    }

    actualizarSelectorSKUsPorMarcaYTipo();
}

function actualizarSelectorTiposPorMarca() {
    const marca = document.getElementById("selectFiltroMarca").value;
    const selTipo = document.getElementById("selectFiltroTipo");
    const tiposObj = arbolMarcasCatalogo[marca] || {};
    const tipos = Object.keys(tiposObj);

    selTipo.innerHTML = tipos.map(t => `<option value="${t}">${t} (${tiposObj[t].length} SKU)</option>`).join("");
    actualizarElegibilidadProductosSegunCupon();
}

function actualizarSelectorSKUsPorMarcaYTipo() {
    const marca = document.getElementById("selectFiltroMarca").value;
    const tipo = document.getElementById("selectFiltroTipo").value;
    const selSKU = document.getElementById("selectSKUIndividual");
    const cupon = obtenerCuponSeleccionadoObjeto();

    const listaSKUs = (arbolMarcasCatalogo[marca] && arbolMarcasCatalogo[marca][tipo]) || [];

    selSKU.innerHTML = listaSKUs.map(p => {
        const elegible = esProductoElegibleParaCuponLocal(p, cupon);
        const notaNoElegible = !elegible
            ? ` 🚫 [No aplicable: cuesta S/ ${p.precio_unitario.toFixed(2)} ≤ S/ ${cupon.valor_descuento.toFixed(2)}]`
            : "";
        return `
            <option value="${p.id_producto}" ${!elegible ? "disabled" : ""}>
                ${p.sku} · ${p.nombre} — Precio Base: S/ ${p.precio_unitario.toFixed(2)}${notaNoElegible}
            </option>
        `;
    }).join("");
}

async function aplicarCuponSeleccionadoAlSKU() {
    const idProd = parseInt(document.getElementById("selectSKUIndividual").value);
    const cupon = obtenerCuponSeleccionadoObjeto();
    const feedback = document.getElementById("mensajeResultadoCupon");

    if (!idProd || !cupon) {
        feedback.style.color = "#b91c1c";
        feedback.textContent = "⚠️ Selecciona un SKU elegible (que no esté en gris) y un cupón válido.";
        return;
    }

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
    window.scrollTo({ top: 120, behavior: "smooth" });
}

function renderizarTablaGeneralAuditoriaPrecios() {
    const contenedor = document.getElementById("contenedorTablaAuditoriaPrecios");

    const filasHTML = todosLosProductosAuditoria.map(p => {
        const stockBadge = p.stock_actual > 0
            ? `<span class="stock-badge stock-verde">${p.stock_actual} unid.</span>`
            : `<span class="stock-badge stock-rojo">Agotado (0)</span>`;

        const celdaPromocional = p.precio_promocion !== null
            ? `<strong style="color:#0d9488;">S/ ${p.precio_promocion.toFixed(2)}</strong>`
            : `<span style="color:#94a3b8;">— Sin promo —</span>`;

        const celdaCupon = p.codigo_cupon
            ? `<span class="tag-badge">🎟️ ${p.codigo_cupon}</span>`
            : `<span style="color:#94a3b8; font-size:0.82rem;">Ninguno</span>`;

        return `
            <tr>
                <td><code>${p.sku}</code></td>
                <td><strong>${p.nombre}</strong></td>
                <td><span class="brand-badge">${p.marca}</span> <small>${p.categoria}</small></td>
                <td style="text-align:center;">${stockBadge}</td>
                <td>S/ ${p.precio_unitario.toFixed(2)}</td>
                <td>${celdaPromocional}</td>
                <td>${celdaCupon}</td>
                <td style="text-align:right;"><strong style="color:#0284c7;">S/ ${p.precio_vigente_caja.toFixed(2)}</strong></td>
                <td style="text-align:center;">
                    <button class="btn btn-sand" style="padding:0.35rem 0.65rem; font-size:0.78rem;"
                            onclick="seleccionarProductoEnArbolDesdeTabla(${p.id_producto}, '${p.marca}', '${p.categoria}')">
                        🎯 Seleccionar SKU
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    contenedor.innerHTML = `
        <table class="audit-prices-table" data-scrum="US012 / CA029 & CA030 · Tabla completa de productos con SKU, stock, precio actual y precio promocional">
            <thead>
                <tr>
                    <th>SKU Único</th>
                    <th>Nombre del Producto</th>
                    <th>Marca / Subproducto</th>
                    <th style="text-align:center;">Stock</th>
                    <th>Precio Actual</th>
                    <th>Precio Promocional</th>
                    <th>Cupón Activo</th>
                    <th style="text-align:right;">Cobro en Caja</th>
                    <th style="text-align:center;">Acción</th>
                </tr>
            </thead>
            <tbody>
                ${filasHTML}
            </tbody>
        </table>
    `;
}

// --- VENTANA FLOTANTE PARA CREAR NUEVO CUPÓN ---
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
    const inputValor = document.getElementById("inputCuponValor");
    if (tipo === "PROMO_2X1") {
        inputValor.value = "100";
        inputValor.disabled = true;
    } else {
        inputValor.disabled = false;
    }
}

async function guardarNuevoCuponModal() {
    const nombre = document.getElementById("inputCuponNombre").value.trim();
    const codigo = document.getElementById("inputCuponCodigo").value.trim();
    const descripcion = document.getElementById("inputCuponDescripcion").value.trim();
    const tipo = document.getElementById("selectCuponTipo").value;
    const valor = parseFloat(document.getElementById("inputCuponValor").value || "0");

    const res = await fetch("/api/v1/catalogo/cupones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nombre_cupon: nombre,
            codigo_cupon: codigo,
            descripcion_accion: descripcion,
            tipo_descuento: tipo,
            valor_descuento: valor
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
// SIG // wqXQ9XWLJ9QCBmpfg5eW0RgTMjAyNjA4MTAxODIxMjAu
// SIG // NTE1WjAEgAIB9KCB0aSBzjCByzELMAkGA1UEBhMCVVMx
// SIG // EzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
// SIG // ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjElMCMGA1UECxMcTWljcm9zb2Z0IEFtZXJpY2Eg
// SIG // T3BlcmF0aW9uczEnMCUGA1UECxMeblNoaWVsZCBUU1Mg
// SIG // RVNOOkYwMDItMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNy
// SIG // b3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNloIIR7TCCByAw
// SIG // ggUIoAMCAQICEzMAAAIgJOHm4Be5tI4AAQAAAiAwDQYJ
// SIG // KoZIhvcNAQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwHhcNMjYwMjE5MTkzOTUyWhcNMjcwNTE3MTkz
// SIG // OTUyWjCByzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldh
// SIG // c2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNV
// SIG // BAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjElMCMGA1UE
// SIG // CxMcTWljcm9zb2Z0IEFtZXJpY2EgT3BlcmF0aW9uczEn
// SIG // MCUGA1UECxMeblNoaWVsZCBUU1MgRVNOOkYwMDItMDVF
// SIG // MC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1T
// SIG // dGFtcCBTZXJ2aWNlMIICIjANBgkqhkiG9w0BAQEFAAOC
// SIG // Ag8AMIICCgKCAgEA0WGO8q+4o1ugkde/Lir3iDLn7rVj
// SIG // onMYCcCjnHv9hjkHHrrOmVn19eIt4zYNyTj+zBiTJDgL
// SIG // nMFgcIgPFEafmWJBo6VaFZBmbFdu1o6i8KX9gMKgbCf0
// SIG // 86sBOyRRWsbqdy3cY/Bo3ScpgxUa3VTf6WB6ARa4w9SJ
// SIG // CA7vG9Qlp/LYKJoikUmPkk7yavfZlZHaYTASFBjnoEJ8
// SIG // vKkXduFTBNMYvDqJpLPWavRIw3ihxqbwG11BEOpt3ETq
// SIG // BD4UxP5osHkB/U6ibdyDrKj79y/Lq6Iwe+O1wQtstAgy
// SIG // B5Si3C5d2RvA+yVyp1kxXp95rDDyaXL60N81AVSax/5i
// SIG // N0cR5gofaaQz9LhtfjycJOh/8frH6BvYVuuMaF5Kcegx
// SIG // HzWTX3F3Sm1xdvFxF3SzZ86N0izVcpnkCYTajkioZ1PO
// SIG // EJypq4xJOeNSYrq5QwpAljvZVAVDG/cdJ8n11GzUT1S4
// SIG // D/j0zEXVzqMCXWAswkHzdmai9LOGCNvBdQ25+wYMNhOD
// SIG // 9RPbp7LzMyR7c4Utk4d06QnwWzhmpSJRfcfwyWf7LJv8
// SIG // ss0/WLSBXqpnzcQT0xN2jroeh8ZkyAs32AAE71jYQW6N
// SIG // fUMLIz3gPSb4akywtilDYK166BsuHg2aNJ+4xWI2ZFIo
// SIG // dU8vvBOqhL1djWumeYFMg+WvrRxg5quvQplIh38CAwEA
// SIG // AaOCAUkwggFFMB0GA1UdDgQWBBTbyJzgiIcRgPJmO5dY
// SIG // NO1B78jYMzAfBgNVHSMEGDAWgBSfpxVdAF5iXYP05dJl
// SIG // pxtTNRnpcjBfBgNVHR8EWDBWMFSgUqBQhk5odHRwOi8v
// SIG // d3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NybC9NaWNy
// SIG // b3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAxMCgx
// SIG // KS5jcmwwbAYIKwYBBQUHAQEEYDBeMFwGCCsGAQUFBzAC
// SIG // hlBodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3Bz
// SIG // L2NlcnRzL01pY3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQ
// SIG // Q0ElMjAyMDEwKDEpLmNydDAMBgNVHRMBAf8EAjAAMBYG
// SIG // A1UdJQEB/wQMMAoGCCsGAQUFBwMIMA4GA1UdDwEB/wQE
// SIG // AwIHgDANBgkqhkiG9w0BAQsFAAOCAgEArShgbaNQUr5u
// SIG // FhSPidDUslYVNSxy+xd3242dnexeSp/xQkwWV6c6w1Ze
// SIG // txS0TXCBaZycuP55YON6+0+bCT3aODLPAA0h0BCZx0rt
// SIG // 8fVKYws0RAT4vfpx4bw4Ecf9VpgQ+oEFGSSzoXDdk8Vu
// SIG // CicoYpzLYgRbZDUWdr5mdTAHTV05uXdC8JN8M4/v3+1Q
// SIG // gk1glyUqKjWt1VP+rAAhyPexL2584PG3d4ca38+gnAlb
// SIG // n++3oL0R4p7YSbsEkXjz+2lZnHr29Z1lCACAnQXmx0Dq
// SIG // 8zSHlgSEML3BWkt0hXPuPa6q8EDjBQ0eBWAc0u29EHgV
// SIG // cRbiy9olbuCgBzDVISy0g+IiiwxQTUzrU805YRrzIBu+
// SIG // wNXI3kKwzB2uqEXjA3lA6h1K8b/IOyEXSIfodIAy5Mzd
// SIG // MSLs5YtAb+ybcmxiW1eicWgxeAs0giDEaSufZyOoiqOC
// SIG // 4J20AWSVu/umpGLChv6Vz5X8Tb9iJ6Q9dLUgpAr8PZK+
// SIG // ltfjUTfhLmXM0YAMFpXCvVyWd7rv7/6MR7Tu/5JlSLOd
// SIG // RfalemNkDV3erVOOmD6yvfJtkA8rPpbyzYpitHtcWe2d
// SIG // RmsCqIShr5SwC1g5WUKoB3yd9QgdC5SAyO4i8mE6Xdos
// SIG // io6rJG0IsjLSAh/kZh/6AoOyTitGQN1yDG2vWkloARd0
// SIG // GeqRtxBnkKowggdxMIIFWaADAgECAhMzAAAAFcXna54C
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
// SIG // bGQgVFNTIEVTTjpGMDAyLTA1RTAtRDk0NzElMCMGA1UE
// SIG // AxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZaIj
// SIG // CgEBMAcGBSsOAwIaAxUAkxgPb6bCeoJagi5iNK4IBseG
// SIG // BBKggYMwgYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UE
// SIG // CBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEe
// SIG // MBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYw
// SIG // JAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0Eg
// SIG // MjAxMDANBgkqhkiG9w0BAQsFAAIFAO4kXTIwIhgPMjAy
// SIG // NjA4MTAxNDIyNDJaGA8yMDI2MDgxMTE0MjI0MlowdzA9
// SIG // BgorBgEEAYRZCgQBMS8wLTAKAgUA7iRdMgIBADAKAgEA
// SIG // AgIYxwIB/zAHAgEAAgIVMDAKAgUA7iWusgIBADA2Bgor
// SIG // BgEEAYRZCgQCMSgwJjAMBgorBgEEAYRZCgMCoAowCAIB
// SIG // AAIDB6EgoQowCAIBAAIDAYagMA0GCSqGSIb3DQEBCwUA
// SIG // A4IBAQBhujevlZZ+BA10c/KHFPWlmYOC6Slx8PYkA8HC
// SIG // 3aZL75b7IFh1IqsF/1iMPsXlf3J8bEfCkfUG8VZGVkFY
// SIG // ShIuwSxUaBkcscf4Gd5/rmLA/YEAPgXcGZ/nnn94VvZc
// SIG // UBHz8k8J2w+v+Swy1BhdIKMRKjfCteSQqXjmtRXZH+ME
// SIG // V+i4gv1Q4hgTCwYm+F5snXrhZfkHLcchnOo62d6lGrn0
// SIG // E51s+ACyKsMqwdj9dcuz5sTUSwabipKLGZ53mqyHe0e9
// SIG // 5QmYu0+/onY+vcsRciYmkt8We1/K/WyHs87VC6qPXwPU
// SIG // FYcGTSAjPQBzAAOmIzYtijkM6c/4TY8lqjlfYDvtMYIE
// SIG // DTCCBAkCAQEwgZMwfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTACEzMAAAIgJOHm4Be5tI4AAQAAAiAwDQYJYIZI
// SIG // AWUDBAIBBQCgggFKMBoGCSqGSIb3DQEJAzENBgsqhkiG
// SIG // 9w0BCRABBDAvBgkqhkiG9w0BCQQxIgQgLgWgoZi3ZMU7
// SIG // LtSVzUhoMoGs5fq3pvCOEKOBnBkjuxEwgfoGCyqGSIb3
// SIG // DQEJEAIvMYHqMIHnMIHkMIG9BCDje78jpTwNVapRKdEC
// SIG // FRpTXfEuWFgZyo/ey7k1h0jtrzCBmDCBgKR+MHwxCzAJ
// SIG // BgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAw
// SIG // DgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3Nv
// SIG // ZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29m
// SIG // dCBUaW1lLVN0YW1wIFBDQSAyMDEwAhMzAAACICTh5uAX
// SIG // ubSOAAEAAAIgMCIEIGJPX2wmpNWo8Wv6+zLJb0HsE7H0
// SIG // b6ddiOzIAzlHktC+MA0GCSqGSIb3DQEBCwUABIICAJZK
// SIG // znam+5DRb6JJkHl6AUeYOEg7iLmrvu+Vq2nYJknISJrc
// SIG // qEi835sQ71UZe9VGMu1+fRbjkFVfcy7I3kHBKfKC0jki
// SIG // +A7i21NZMIyuYJQllUl60kLKfxMjneLAmWW5ZwlVWQ3Z
// SIG // iE6OnsLYh4zH2rCv4R5BevcFbTlXyIrnut9y/YQg1CTK
// SIG // v7eL+6iDazfklnDHahwRGNyKeonGdtjXchEJP7XZkaR+
// SIG // 5pkc9VbTSe0JqCjUkFbxVCwzMN72X5Zi3Q0afgI+OZoz
// SIG // NoOkQQoCH6n2Zzjfl53ssxjyOCawtUzI9eNSd/JfQOXl
// SIG // qA9jE1ffeqg49TDFdHds5b2Q8AYUyByoTAuRJgKx3ztq
// SIG // igs0+CDxWJn9DbFL4sHyAVOBiSwi2rdWXEXN6lDkR9py
// SIG // kI5llWEj+8U7rNPO6Ql6LQ0PPLd/VFfrE6vjS7zslmdS
// SIG // lB3gDCztyh+FxRKYuNPN0apQF/7iepywzrWJcFbWl5Bl
// SIG // AkJ86urs/VYAuc00IMgZOqP93j2oB5pmKi/PR8VDPnXE
// SIG // fyU6Y8AX0xVng0CUl27OrC0WYzLVYBJEPBFR+FzMHZay
// SIG // Mm8jFY/Quez+YFv7IQ6ZvxsgoizmpAN5o/6hOfsU3hRx
// SIG // 7dHnEjxtCY51d5LyiVhw5RILH2ZbPyCLL7T6IhZVmwcY
// SIG // /+6RAaiJDMmemVCNS9am
// SIG // End signature block
