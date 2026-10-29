document.addEventListener("DOMContentLoaded", () => {
    cargarCategoriasPrincipales();
    ejecutarBusquedaPorCategoria(1, "Cañas de Pesca");
});

// Alternar entre Kiosco Cliente y Panel Administrador
function cambiarVista(vista) {
    const vCliente = document.getElementById("vistaCliente");
    const vAdmin = document.getElementById("vistaAdmin");
    const bCliente = document.getElementById("btnVistaCliente");
    const bAdmin = document.getElementById("btnVistaAdmin");

    if (vista === "cliente") {
        vCliente.classList.remove("hidden");
        vAdmin.classList.add("hidden");
        bCliente.classList.add("active");
        bAdmin.classList.remove("active");
    } else {
        vCliente.classList.add("hidden");
        vAdmin.classList.remove("hidden");
        bCliente.classList.remove("active");
        bAdmin.classList.add("active");
        consultarPrecioSincronizado();
    }
}

// =========================================================================
// US001: BÚSQUEDA POR TEXTO, AUTOCOMPLETADO Y LIMPIEZA (CA001 - CA004)
// =========================================================================
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
        .map(item => `<li onclick="seleccionarSugerencia('${item.replace(/'/g, "\\'")}')">🔍 ${item}</li>`)
        .join("");
    lista.classList.remove("hidden");
}

function seleccionarSugerencia(texto) {
    document.getElementById("inputBusqueda").value = texto;
    document.getElementById("listaAutocompletado").classList.add("hidden");
    ejecutarBusquedaTexto();
}

async function ejecutarBusquedaTexto() {
    const input = document.getElementById("inputBusqueda");
    const q = input.value.trim();
    document.getElementById("listaAutocompletado").classList.add("hidden");

    if (!q) {
        limpiarBusquedaUI();
        return;
    }

    const res = await fetch(`/api/v1/busqueda/texto?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    document.getElementById("tituloResultados").textContent = `🔎 Resultados para: "${data.termino_buscado}"`;

    if (!data.tuvo_resultados) {
        // CA003: Mostrar mensaje "No se encontraron productos" y sugerir categorías
        document.getElementById("grillaProductos").innerHTML = "";
        document.getElementById("contadorResultados").textContent = "0 artículos";
        const alerta = document.getElementById("alertaSinResultados");
        alerta.classList.remove("hidden");

        const contSug = document.getElementById("categoriasSugeridasCA003");
        contSug.innerHTML = data.categorias_sugeridas
            .map(c => `
                <button class="category-card" onclick="ejecutarBusquedaPorCategoria(${c.id_categoria}, '${c.nombre}')">
                    <strong>${c.nombre}</strong>
                    <span>${c.descripcion || ""}</span>
                </button>
            `).join("");
        return;
    }

    document.getElementById("alertaSinResultados").classList.add("hidden");
    renderizarProductos(data.resultados);
}

async function limpiarBusquedaUI() {
    // CA004: Limpieza del campo de búsqueda y restablecimiento de vista
    await fetch("/api/v1/busqueda/limpiar", { method: "POST" });
    document.getElementById("inputBusqueda").value = "";
    document.getElementById("listaAutocompletado").classList.add("hidden");
    document.getElementById("alertaSinResultados").classList.add("hidden");
    volverMenuCategoriasUI();
}

// =========================================================================
// US002: NAVEGACIÓN POR CATEGORÍAS Y SUBCATEGORÍAS (CA005 - CA007)
// =========================================================================
async function cargarCategoriasPrincipales(idActiva = null) {
    const res = await fetch("/api/v1/busqueda/categorias");
    const data = await res.json();
    const cont = document.getElementById("contenedorCategorias");

    cont.innerHTML = data.categorias_principales
        .map(c => `
            <button class="category-card ${idActiva === c.id_categoria ? 'selected' : ''}"
                    onclick="ejecutarBusquedaPorCategoria(${c.id_categoria}, '${c.nombre}')">
                <strong>${c.nombre}</strong>
                <span>${c.descripcion || ""}</span>
            </button>
        `).join("");
}

async function ejecutarBusquedaPorCategoria(idCategoria, nombreCategoria) {
    const res = await fetch(`/api/v1/busqueda/categorias/${idCategoria}/productos`);
    const data = await res.json();

    document.getElementById("alertaSinResultados").classList.add("hidden");
    document.getElementById("tituloResultados").textContent = `📂 Categoría: ${nombreCategoria}`;
    document.getElementById("btnVolverCategorias").classList.remove("hidden");

    const subBar = document.getElementById("contenedorSubcategorias");
    if (data.subcategorias_disponibles && data.subcategorias_disponibles.length > 0) {
        subBar.innerHTML = `<strong>Subcategorías de ${nombreCategoria} (CA006):</strong> ` +
            data.subcategorias_disponibles.map(sub => `
                <button class="btn btn-outline" onclick="ejecutarBusquedaPorCategoria(${sub.id_categoria}, '${sub.nombre}')">
                    🔹 ${sub.nombre}
                </button>
            `).join("");
        subBar.classList.remove("hidden");
    }

    renderizarProductos(data.productos);
}

async function volverMenuCategoriasUI() {
    // CA007: Retorno al menú principal de categorías
    const res = await fetch("/api/v1/busqueda/categorias/volver", { method: "POST" });
    const data = await res.json();

    document.getElementById("contenedorSubcategorias").classList.add("hidden");
    document.getElementById("btnVolverCategorias").classList.add("hidden");
    cargarCategoriasPrincipales();
    ejecutarBusquedaPorCategoria(1, "Cañas de Pesca");
}

// =========================================================================
// US010 Y US011: TARJETAS CON STOCK EN TIEMPO REAL Y FICHA TÉCNICA (CA024-CA028)
// =========================================================================
function renderizarProductos(productos) {
    const grilla = document.getElementById("grillaProductos");
    document.getElementById("contadorResultados").textContent = `${productos.length} artículo(s)`;

    grilla.innerHTML = productos.map(p => {
        const precio = (p.precio_vigente !== undefined ? p.precio_vigente : p.precio).toFixed(2);
        const disponible = p.stock_actual > 0;
        const claseStock = disponible ? "stock-verde" : "stock-rojo";
        const textoStock = disponible
            ? `🟢 Disponible en tienda (${p.stock_actual} unid.)`
            : `🔴 Agotado (0 unid.)`;

        return `
            <article class="product-card">
                <div>
                    <span class="sku-tag">SKU: ${p.sku} · ${p.marca}</span>
                    <h3 style="margin: 0.35rem 0; font-size: 1.02rem;">${p.nombre}</h3>
                    <span class="stock-pill ${claseStock}">${textoStock}</span>
                </div>
                <div>
                    <div class="price-tag">S/ ${precio}</div>
                    <div class="btn-group" style="margin-top: 0.65rem;">
                        <button class="btn btn-secondary" style="flex:1;" onclick="abrirFichaTecnica(${p.id_producto})">
                            📋 Ficha Técnica (US011)
                        </button>
                        <button class="btn btn-primary" ${!disponible ? "disabled" : ""}
                                onclick="alert('Producto disponible listo para lista temporal (Módulo Sprint 3)')">
                            ${disponible ? "➕ Seleccionar" : "🚫 Bloqueado (CA025)"}
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

async function abrirFichaTecnica(idProducto) {
    // Consume GET /api/v1/catalogo/productos/<id>/ficha (CA027 y CA028)
    const res = await fetch(`/api/v1/catalogo/productos/${idProducto}/ficha`);
    const f = await res.json();

    document.getElementById("modalTituloProducto").textContent = `${f.nombre} (${f.sku})`;

    const imgPrincipal = f.galeria_imagenes[0];
    const avisoDefault = imgPrincipal.es_default
        ? `<div class="stock-pill stock-rojo" style="margin-bottom:0.5rem;">⚠️ ${imgPrincipal.leyenda} (CA028 - Imagen por defecto aplicada)</div>`
        : `<div class="stock-pill stock-verde" style="margin-bottom:0.5rem;">📸 ${f.galeria_imagenes.length} imagen(es) en resolución ${imgPrincipal.resolucion} (CA027)</div>`;

    const etiquetasHTML = f.etiquetas && f.etiquetas.length > 0
        ? f.etiquetas.map(e => `<span class="tag-chip">${e.nombre_etiqueta} (${e.tipo_etiqueta})</span>`).join("")
        : `<span class="hint">Sin etiquetas técnicas indexadas</span>`;

    document.getElementById("modalCuerpoProducto").innerHTML = `
        ${avisoDefault}
        <p style="margin-bottom:0.5rem;"><strong>Ruta de Imagen Principal:</strong> <code>${imgPrincipal.url_imagen}</code></p>
        <p style="margin-bottom:0.8rem;"><strong>Descripción Técnica:</strong> ${f.descripcion_tecnica}</p>

        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:0.75rem; border-radius:8px;">
            <div>
                <strong>Estado en Inventario (US010):</strong>
                <span class="stock-pill ${f.inventario.indicador_color === 'verde' ? 'stock-verde' : 'stock-rojo'}">
                    ${f.inventario.leyenda} (${f.inventario.stock_actual} unidades)
                </span>
            </div>
            <div class="price-tag">S/ ${f.precio_vigente.toFixed(2)}</div>
        </div>

        <h4 style="margin-top:1rem;">Especificaciones Técnicas en Base de Datos:</h4>
        <table class="specs-table">
            <tr><th>Marca / Categoría</th><td>${f.marca} · ${f.categoria}</td></tr>
            <tr><th>Resistencia Línea (lb)</th><td>${f.especificaciones.resistencia_min_lb ?? '-'} a ${f.especificaciones.resistencia_max_lb ?? '-'} lb</td></tr>
            <tr><th>Peso (g)</th><td>${f.especificaciones.peso_gr ?? '-'} g</td></tr>
            <tr><th>Potencia / Acción</th><td>${f.especificaciones.potencia ?? '-'} / ${f.especificaciones.accion ?? '-'}</td></tr>
            <tr><th>Entorno Recomendado</th><td>${f.especificaciones.entorno_recomendado ?? '-'}</td></tr>
        </table>

        <h4 style="margin-top:1rem;">Etiquetas Indexadas para Motor IA (US009):</h4>
        <div class="tags-container">${etiquetasHTML}</div>
    `;

    document.getElementById("modalFicha").classList.remove("hidden");
}

function cerrarModalFicha() {
    document.getElementById("modalFicha").classList.add("hidden");
}

// =========================================================================
// PANEL ADMINISTRADOR: US009 (CA021-CA023) Y US012 (CA029-CA030)
// =========================================================================
async function sugerirEtiquetasIA() {
    const descripcion = document.getElementById("txtDescripcionIA").value;
    const res = await fetch("/api/v1/catalogo/etiquetas/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion_tecnica: descripcion })
    });
    const data = await res.json();
    const cont = document.getElementById("resultadoSugerenciasIA");

    if (!data.sugerencias || data.sugerencias.length === 0) {
        cont.innerHTML = `<span class="hint">No se detectaron palabras clave técnicas en el texto.</span>`;
        return;
    }

    cont.innerHTML = data.sugerencias
        .map(s => `<span class="tag-chip">✨ ${s.nombre_etiqueta} (${s.tipo_etiqueta})</span>`)
        .join("");
}

async function asignarEtiquetaManual() {
    const idProd = document.getElementById("inputIdProdEtiqueta").value;
    const idEtiq = document.getElementById("selectIdEtiqueta").value;

    const res = await fetch(`/api/v1/catalogo/productos/${idProd}/etiquetas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_etiqueta: parseInt(idEtiq) })
    });
    const data = await res.json();
    document.getElementById("salidaConsolaEtiquetas").textContent = JSON.stringify(data, null, 2);
}

async function consultarFichaAdmin() {
    const idProd = document.getElementById("inputIdProdEtiqueta").value;
    const res = await fetch(`/api/v1/catalogo/productos/${idProd}/ficha`);
    const data = await res.json();
    document.getElementById("salidaConsolaEtiquetas").textContent = JSON.stringify({
        id_producto: data.id_producto,
        nombre: data.nombre,
        etiquetas_indexadas: data.etiquetas
    }, null, 2);
}

async function consultarPrecioSincronizado() {
    const idProd = document.getElementById("inputIdProdPrecio").value;
    const res = await fetch(`/api/v1/catalogo/productos/${idProd}/precio`);
    const data = await res.json();
    const box = document.getElementById("tarjetaPrecioSincronizado");

    if (res.status !== 200) {
        box.innerHTML = `<p style="color:red;">Producto no encontrado</p>`;
        return;
    }

    box.innerHTML = `
        <div style="background:#f8fafc; padding:0.85rem; border-radius:8px; border:1px solid #cbd5e1;">
            <strong>${data.nombre} (${data.sku})</strong><br>
            <span>Precio Regular: S/ ${data.precio_regular.toFixed(2)}</span> |
            <span>Promoción Vigente: ${data.en_promocion ? 'S/ ' + data.precio_promocion.toFixed(2) : 'Sin promo'}</span><br>
            <strong style="color:#0284c7; font-size:1.1rem;">Precio Sincronizado Caja: S/ ${data.precio_vigente_caja.toFixed(2)}</strong>
        </div>
    `;
}

async function verificarIntegridadPreciosLista() {
    const payload = {
        items: [
            { id_producto: 1, cantidad: 2, precio_capturado: 145.00 },
            { id_producto: 3, cantidad: 1, precio_capturado: 165.00 }
        ]
    };

    const res = await fetch("/api/v1/catalogo/precios/verificar-lista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    document.getElementById("salidaConsolaPrecios").textContent = JSON.stringify(data, null, 2);
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
