importScripts('db.js');

// ---------------------------------------------------------------------------
// Funções injetadas na página (rodam DENTRO da aba que está sendo capturada)
// ---------------------------------------------------------------------------

function pagePrepare() {
  const old = window.__fpc;
  if (old && old.style) old.style.remove();

  const de = document.documentElement;
  const state = { startX: window.scrollX, startY: window.scrollY, hidden: [], el: null };
  window.__fpc = state;

  // Esconde barras de rolagem e desliga a rolagem suave durante a captura
  const style = document.createElement('style');
  style.textContent =
    'html{scroll-behavior:auto!important}' +
    '*{scrollbar-width:none!important;scroll-behavior:auto!important}' +
    '*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}';
  (document.head || de).appendChild(style);
  state.style = style;

  const vh = window.innerHeight;
  const docH = Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0);

  // Página normal: rola a janela
  if (docH > vh + 5) {
    return {
      mode: 'window',
      total: docH,
      step: vh,
      rect: { x: 0, y: 0, w: de.clientWidth || window.innerWidth, h: vh },
      viewportW: window.innerWidth,
      title: document.title,
      url: location.href,
    };
  }

  // Página "aplicativo" (ex.: Gmail, Drive): procura o maior elemento rolável
  let best = null;
  let bestArea = 0;
  for (const el of document.querySelectorAll('body, body *')) {
    if (el.scrollHeight <= el.clientHeight + 50 || el.clientHeight < 100) continue;
    const oy = getComputedStyle(el).overflowY;
    if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') continue;
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (w * h > bestArea) { bestArea = w * h; best = el; }
  }

  if (best) {
    state.el = best;
    state.elStart = best.scrollTop;
    const r = best.getBoundingClientRect();
    const x = Math.max(0, r.left + best.clientLeft);
    const y = Math.max(0, r.top + best.clientTop);
    const w = Math.min(best.clientWidth, window.innerWidth - x);
    const h = Math.min(best.clientHeight, vh - y);
    return {
      mode: 'element',
      total: best.scrollHeight,
      step: h,
      rect: { x, y, w, h },
      viewportW: window.innerWidth,
      title: document.title,
      url: location.href,
    };
  }

  // Página que cabe em uma única tela
  return {
    mode: 'window',
    total: vh,
    step: vh,
    rect: { x: 0, y: 0, w: de.clientWidth || window.innerWidth, h: vh },
    viewportW: window.innerWidth,
    title: document.title,
    url: location.href,
  };
}

function pageScrollTo(y) {
  const s = window.__fpc;
  if (s && s.el) {
    s.el.scrollTop = y;
    return { y: s.el.scrollTop, total: s.el.scrollHeight };
  }
  window.scrollTo(0, y);
  const de = document.documentElement;
  return {
    y: window.scrollY,
    total: Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0),
  };
}

function pageHideFixed() {
  const s = window.__fpc;
  if (!s) return 0;
  const target = s.el;
  for (const el of document.querySelectorAll('body *')) {
    if (el === target || (target && el.contains(target))) continue;
    const pos = getComputedStyle(el).position;
    if (pos === 'fixed' || pos === 'sticky') {
      s.hidden.push([el, el.style.getPropertyValue('visibility'), el.style.getPropertyPriority('visibility')]);
      el.style.setProperty('visibility', 'hidden', 'important');
    }
  }
  return s.hidden.length;
}

function pageRestore() {
  const s = window.__fpc;
  if (!s) return;
  for (const [el, val, prio] of s.hidden) {
    if (val) el.style.setProperty('visibility', val, prio);
    else el.style.removeProperty('visibility');
  }
  if (s.style) s.style.remove();
  if (s.el) s.el.scrollTop = s.elStart;
  window.scrollTo(s.startX, s.startY);
  delete window.__fpc;
}

// ---------------------------------------------------------------------------
// Controle da captura (roda no service worker)
// ---------------------------------------------------------------------------

const MAX_CAPTURES = 150;          // limite de segurança (~150 telas)
const MIN_CAPTURE_INTERVAL = 550;  // o Chrome permite no máx. 2 capturas por segundo
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let job = null; // { tabId, windowId, progress, cancel }

async function run(tabId, func, args = []) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return res ? res.result : undefined;
}

function setBadge(text, color = '#2563eb') {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
}

async function captureLoop(tab, info, delay) {
  const tabId = tab.id;
  const captures = [];
  let lastCapture = 0;
  let target = 0;
  let prevY = -1;
  let total = info.total;

  try {
    while (captures.length < MAX_CAPTURES) {
      if (job.cancel) throw new Error('Captura cancelada.');

      const pos = await run(tabId, pageScrollTo, [target]);
      total = Math.max(total, pos.total);
      if (pos.y === prevY) break; // não rola mais
      await sleep(delay);

      // Depois do primeiro print, esconde cabeçalhos/menus fixos para não repetirem
      if (captures.length === 1) {
        await run(tabId, pageHideFixed);
        await sleep(80);
      }

      const t = await chrome.tabs.get(tabId);
      if (!t.active) throw new Error('A aba foi trocada durante a captura. Mantenha a página visível até terminar.');

      const wait = MIN_CAPTURE_INTERVAL - (Date.now() - lastCapture);
      if (wait > 0) await sleep(wait);
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 95 });
      lastCapture = Date.now();

      const blob = await (await fetch(dataUrl)).blob();
      captures.push({ y: pos.y, blob });
      prevY = pos.y;

      const pct = Math.min(99, Math.round(((pos.y + info.step) / total) * 100));
      job.progress = pct;
      setBadge(pct + '%');

      if (pos.y + info.step >= total - 1) break;
      target = pos.y + info.step;
    }
  } finally {
    try { await run(tabId, pageRestore); } catch (e) { /* aba fechada */ }
  }

  const id = 'job-' + Date.now();
  await FPC_DB.clear(); // guarda só a captura mais recente
  await FPC_DB.put(id, {
    title: info.title,
    url: info.url,
    date: new Date().toISOString(),
    mode: info.mode,
    rect: info.rect,
    viewportW: info.viewportW,
    step: info.step,
    total,
    truncated: captures.length >= MAX_CAPTURES,
    captures,
  });
  return id;
}

async function startCapture(tabId) {
  if (job) throw new Error('Já existe uma captura em andamento.');
  const tab = await chrome.tabs.get(tabId);
  const { delay = 600 } = await chrome.storage.local.get('delay');

  let info;
  try {
    info = await run(tabId, pagePrepare);
  } catch (e) {
    throw new Error('Esta página não pode ser capturada (páginas internas do Chrome, a Chrome Web Store e alguns PDFs são bloqueados pelo navegador).');
  }
  if (!info) throw new Error('Não foi possível ler a página.');

  job = { tabId, progress: 0, cancel: false };
  setBadge('0%');

  // Continua em segundo plano; o popup já pode fechar
  (async () => {
    try {
      const id = await captureLoop(tab, info, delay);
      setBadge('');
      await chrome.tabs.create({
        url: chrome.runtime.getURL('result.html?id=' + id),
        index: tab.index + 1,
        openerTabId: tab.id,
      });
    } catch (e) {
      setBadge('ERR', '#dc2626');
      setTimeout(() => setBadge(''), 4000);
      await chrome.storage.local.set({ lastError: e.message });
    } finally {
      job = null;
    }
  })();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'start') {
    chrome.storage.local.remove('lastError');
    startCapture(msg.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'status') {
    sendResponse(job ? { running: true, progress: job.progress } : { running: false });
    return false;
  }
  if (msg.type === 'cancel') {
    if (job) job.cancel = true;
    sendResponse({ ok: true });
    return false;
  }
});
