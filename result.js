const $ = (id) => document.getElementById(id);

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};
const MAX_SLICE_PX = 16000;   // altura máxima de um canvas por página
const MAX_PDF_PT = 14400;     // limite de tamanho de página do formato PDF

let job, geo, bitmaps;
let pdfBlob = null, pdfUrl = null;
let genToken = 0;

function status(msg) { $('status').textContent = msg; }

function fileBase() {
  const name = (job.title || 'captura')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'captura';
  const d = new Date(job.date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${name} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}h${pad(d.getMinutes())}`;
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// ---- Montagem das imagens ---------------------------------------------------

function computeGeometry() {
  const b0 = bitmaps[0];
  const scale = b0.width / job.viewportW;
  const r = job.rect;
  const cx = Math.max(0, Math.round(r.x * scale));
  const cy = Math.max(0, Math.round(r.y * scale));
  const crop = {
    x: cx,
    y: cy,
    w: Math.min(b0.width - cx, Math.round(r.w * scale)),
    h: Math.min(b0.height - cy, Math.round(r.h * scale)),
  };
  const ys = job.captures.map((c) => Math.round(c.y * scale));
  const lastBottom = ys[ys.length - 1] + crop.h;
  const height = job.truncated ? lastBottom : Math.min(lastBottom, Math.round(job.total * scale)) || lastBottom;
  return { scale, crop, ys, width: crop.w, height };
}

// Desenha o trecho [top, top+h) da página inteira em um canvas
function renderSlice(top, h) {
  const c = document.createElement('canvas');
  c.width = geo.width;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  const { crop } = geo;
  bitmaps.forEach((bmp, i) => {
    const dy = geo.ys[i] - top;
    if (dy >= h || dy + crop.h <= 0) return;
    ctx.drawImage(bmp, crop.x, crop.y, crop.w, crop.h, 0, dy, crop.w, crop.h);
  });
  return c;
}

// Procura o melhor ponto para cortar a página sem atravessar texto.
// Cada linha de pixels recebe uma nota = quantas "bordas" (mudanças bruscas de cor) ela tem.
// Linha de texto tem muitas bordas; espaço entre parágrafos ou entre as folhas de um PDF
// (mesmo com fundo cinza dos lados, como no Google Drive) tem pouquíssimas.
function findCleanCut(canvas, searchFrom) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height - searchFrom;
  if (h <= 0) return canvas.height;
  const data = ctx.getImageData(0, searchFrom, w, h).data;
  const tol = 40;
  const lum = (p) => data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;

  const edges = new Uint32Array(h);
  for (let row = 0; row < h; row++) {
    const base = row * w * 4;
    let prev = lum(base);
    let n = 0;
    for (let x = 1; x < w; x++) {
      const v = lum(base + x * 4);
      if (Math.abs(v - prev) > tol) n++;
      prev = v;
    }
    edges[row] = n;
  }

  // Uma linha só é segura se ela e as vizinhas (±2 px) estão livres: evita cortar
  // rente à base ou ao topo das letras.
  const score = (row) => {
    let m = 0;
    for (let k = -2; k <= 2; k++) {
      const r = Math.min(h - 1, Math.max(0, row + k));
      if (edges[r] > m) m = edges[r];
    }
    return m;
  };

  let best = h - 1;
  let bestScore = Infinity;
  for (let row = h - 1; row >= 0; row--) {
    const s = score(row);
    if (s < bestScore) { bestScore = s; best = row; }
    if (s === 0) break; // linha perfeitamente limpa, a mais baixa possível
  }

  // Dentro da faixa mais limpa, corta no meio dela (sobra respiro nos dois lados)
  let top = best, bottom = best;
  while (top > 0 && score(top - 1) <= bestScore) top--;
  while (bottom < h - 1 && score(bottom + 1) <= bestScore) bottom++;
  return searchFrom + Math.round((top + bottom) / 2);
}

// ---- Modo "uma folha do documento por página" -------------------------------
// Procura as faixas uniformes e escuras/cinzas que separam as folhas em
// visualizadores de PDF (Google Drive, leitor de PDF do Chrome etc.).

function rowStats(data, w, row, step) {
  const base = row * w * 4;
  const hist = new Uint32Array(32);
  let n = 0;
  for (let x = 0; x < w; x += step) {
    const p = base + x * 4;
    const l = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114) | 0;
    hist[l >> 3]++;
    n++;
  }
  let mode = 0;
  for (let i = 1; i < 32; i++) if (hist[i] > hist[mode]) mode = i;
  const near = hist[mode] + (mode > 0 ? hist[mode - 1] : 0) + (mode < 31 ? hist[mode + 1] : 0);
  return { uniform: near / n >= 0.97, lum: mode * 8 + 4 };
}

function detectDocPages() {
  const CHUNK = 2000;
  const w = geo.width;
  const step = Math.max(1, Math.floor(w / 400));
  const sep = new Uint8Array(geo.height);
  let bgSum = [0, 0, 0], bgN = 0;

  for (let top = 0; top < geo.height; top += CHUNK) {
    const h = Math.min(CHUNK, geo.height - top);
    const data = renderSlice(top, h).getContext('2d').getImageData(0, 0, w, h).data;
    for (let r = 0; r < h; r++) {
      const s = rowStats(data, w, r, step);
      if (s.uniform && s.lum < 200) {
        sep[top + r] = 1;
        const p = r * w * 4 + Math.floor(w / 2) * 4;
        bgSum[0] += data[p]; bgSum[1] += data[p + 1]; bgSum[2] += data[p + 2]; bgN++;
      }
    }
  }

  // Faixas separadoras com pelo menos 6 px de altura
  const cuts = [];
  for (let y = 0; y < geo.height;) {
    if (!sep[y]) { y++; continue; }
    let e = y;
    while (e < geo.height && sep[e]) e++;
    if (e - y >= 6 || y === 0 || e === geo.height) cuts.push([y, e]);
    y = e;
  }

  const pages = [];
  let start = 0;
  for (const [a, b] of [...cuts, [geo.height, geo.height]]) {
    if (a - start >= 60) pages.push({ top: start, bottom: a });
    start = b;
  }
  if (pages.length < 2 || !bgN) return null;
  return { pages, bg: bgSum.map((v) => v / bgN) };
}

// Remove as bordas da cor do fundo (cinza do visualizador) em volta da folha
function trimBackground(canvas, bg) {
  const w = canvas.width, h = canvas.height;
  const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const isBg = (p) => Math.abs(data[p] - bg[0]) < 30 && Math.abs(data[p + 1] - bg[1]) < 30 && Math.abs(data[p + 2] - bg[2]) < 30;
  const colBg = (x) => {
    let n = 0, t = 0;
    for (let y = 0; y < h; y += 4) { t++; if (isBg((y * w + x) * 4)) n++; }
    return n / t >= 0.97;
  };
  const rowBg = (y, x0, x1) => {
    let n = 0, t = 0;
    for (let x = x0; x < x1; x += 4) { t++; if (isBg((y * w + x) * 4)) n++; }
    return n / t >= 0.97;
  };
  let x0 = 0, x1 = w;
  while (x0 < w - 1 && colBg(x0)) x0++;
  while (x1 > x0 + 1 && colBg(x1 - 1)) x1--;
  let y0 = 0, y1 = h;
  while (y0 < h - 1 && rowBg(y0, x0, x1)) y0++;
  while (y1 > y0 + 1 && rowBg(y1 - 1, x0, x1)) y1--;
  if (x1 - x0 < 40 || y1 - y0 < 40) return canvas;
  if (x0 === 0 && y0 === 0 && x1 === w && y1 === h) return canvas;
  const c = document.createElement('canvas');
  c.width = x1 - x0;
  c.height = y1 - y0;
  c.getContext('2d').drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

let docLayout; // resultado de detectDocPages(), calculado uma vez

async function generateDocPages(token, size, margin, quality) {
  const [baseW, baseH] = PAGE_SIZES[size];
  const pages = [];
  for (const seg of docLayout.pages) {
    // Folhas muito altas (raro) são divididas em pedaços que cabem num canvas
    for (let top = seg.top; top < seg.bottom; top += MAX_SLICE_PX) {
      const h = Math.min(MAX_SLICE_PX, seg.bottom - top);
      const canvas = trimBackground(renderSlice(top, h), docLayout.bg);
      const jpeg = await canvasToJpeg(canvas, quality);
      if (token !== genToken) return null;

      // Orientação automática: folha "deitada" vai em página paisagem
      const landscape = canvas.width > canvas.height * 1.05;
      const pageW = landscape ? baseH : baseW;
      const pageH = landscape ? baseW : baseH;
      const k = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
      const w = canvas.width * k, hh = canvas.height * k;
      pages.push({
        pageW, pageH,
        x: (pageW - w) / 2, y: (pageH - hh) / 2,
        w, h: hh,
        imgW: canvas.width, imgH: canvas.height,
        jpeg,
      });
      status(`Gerando PDF… página ${pages.length}`);
    }
  }
  return pages;
}

function cropCanvas(canvas, h) {
  if (h >= canvas.height) return canvas;
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = h;
  c.getContext('2d').drawImage(canvas, 0, 0);
  return c;
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(async (b) => resolve(new Uint8Array(await b.arrayBuffer())), 'image/jpeg', quality);
  });
}

// ---- Geração do PDF ---------------------------------------------------------

async function generate() {
  const token = ++genToken;
  $('dlPdf').disabled = true;

  const size = $('size').value;
  const margin = Number($('margin').value);
  const quality = Number($('quality').value);
  const split = $('split').value;
  $('splitWrap').style.display = size === 'continuous' ? 'none' : '';
  $('splitHint').style.display = size === 'continuous' ? 'none' : '';
  const smart = split !== 'plain' && size !== 'continuous';

  if (split === 'doc' && size !== 'continuous') {
    if (docLayout) {
      const pages = await generateDocPages(token, size, margin, quality);
      if (!pages) return;
      return finish(pages);
    }
    status('Não encontrei separação entre folhas nesta página; usando a divisão automática.');
  }

  let pageW, pageH, ptPerPx, slicePx;
  if (size === 'continuous') {
    const cssW = geo.width / geo.scale;
    pageW = cssW * 0.75 + margin * 2; // 1px CSS = 0,75 pt
    ptPerPx = (pageW - margin * 2) / geo.width;
    slicePx = Math.min(MAX_SLICE_PX, Math.floor((MAX_PDF_PT - margin * 2) / ptPerPx));
  } else {
    [pageW, pageH] = PAGE_SIZES[size];
    ptPerPx = (pageW - margin * 2) / geo.width;
    slicePx = Math.floor((pageH - margin * 2) / ptPerPx);
  }

  const pages = [];
  let top = 0;
  while (top < geo.height) {
    let h = Math.min(slicePx, geo.height - top);
    let canvas = renderSlice(top, h);
    if (smart && top + h < geo.height) {
      const cut = findCleanCut(canvas, Math.floor(h * 0.6));
      if (cut > h * 0.5 && cut < h) {
        h = cut;
        canvas = cropCanvas(canvas, h);
      }
    }
    const jpeg = await canvasToJpeg(canvas, quality);
    if (token !== genToken) return; // opções mudaram no meio do caminho

    const drawH = h * ptPerPx;
    const thisPageH = size === 'continuous' ? drawH + margin * 2 : pageH;
    pages.push({
      pageW, pageH: thisPageH,
      x: margin, y: thisPageH - margin - drawH,
      w: pageW - margin * 2, h: drawH,
      imgW: canvas.width, imgH: canvas.height,
      jpeg,
    });
    top += h;
    status(`Gerando PDF… página ${pages.length}`);
  }
  finish(pages);
}

function finish(pages) {
  pdfBlob = buildPdf(pages, job.title);
  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  pdfUrl = URL.createObjectURL(pdfBlob);
  $('preview').src = pdfUrl;
  $('dlPdf').disabled = false;
  const mb = (pdfBlob.size / 1048576).toFixed(1).replace('.', ',');
  status(`PDF pronto: ${pages.length} página${pages.length > 1 ? 's' : ''}, ${mb} MB.`);
}

// ---- Início -----------------------------------------------------------------

(async () => {
  try {
    const id = new URLSearchParams(location.search).get('id');
    job = id && (await FPC_DB.get(id));
    if (!job) {
      status('Esta captura não está mais disponível. Faça uma nova captura.');
      return;
    }
    document.title = 'Captura: ' + (job.title || job.url);
    $('pageTitle').textContent = job.title || job.url;
    $('pageTitle').title = job.url;

    status('Montando as imagens…');
    bitmaps = await Promise.all(job.captures.map((c) => createImageBitmap(c.blob)));
    geo = computeGeometry();

    $('meta').textContent =
      `${job.captures.length} tela${job.captures.length > 1 ? 's' : ''} capturada${job.captures.length > 1 ? 's' : ''} · ` +
      `${geo.width} × ${geo.height} px`;
    if (job.truncated) {
      $('warn').hidden = false;
      $('warn').textContent = 'A página era muito longa: a captura parou no limite de 150 telas.';
    }

    const pngOk = geo.height <= 32000 && geo.width * geo.height <= 200e6;
    $('dlPng').disabled = !pngOk;
    if (!pngOk) $('dlPng').title = 'Página longa demais para uma única imagem PNG. Use o PDF.';

    // Procura as folhas de um documento (PDF no Drive etc.)
    status('Procurando as folhas do documento…');
    docLayout = detectDocPages();
    let saved = null;
    try { saved = localStorage.getItem('split'); } catch (e) { /* sem armazenamento */ }
    if (docLayout) {
      $('splitHint').textContent = `Encontrei ${docLayout.pages.length} folhas de documento nesta captura.`;
      $('split').value = saved || 'doc';
    } else {
      $('split').querySelector('option[value="doc"]').disabled = true;
      $('split').querySelector('option[value="doc"]').textContent += ' (nenhuma folha encontrada)';
      $('split').value = saved && saved !== 'doc' ? saved : 'smart';
    }
    $('split').addEventListener('change', () => {
      try { localStorage.setItem('split', $('split').value); } catch (e) { /* ignora */ }
    });

    ['size', 'margin', 'quality', 'split'].forEach((k) => $(k).addEventListener('change', generate));
    await generate();
  } catch (e) {
    console.error(e);
    status('Erro ao montar a captura: ' + e.message);
  }
})();

$('dlPdf').addEventListener('click', () => {
  if (pdfBlob) download(pdfBlob, fileBase() + '.pdf');
});

$('dlPng').addEventListener('click', () => {
  status('Gerando PNG…');
  const c = renderSlice(0, geo.height);
  c.toBlob((b) => {
    download(b, fileBase() + '.png');
    status('PNG baixado.');
  }, 'image/png');
});
