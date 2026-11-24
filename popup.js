const $ = (id) => document.getElementById(id);

function showError(msg) {
  $('error').textContent = msg;
  $('error').hidden = !msg;
}

async function refresh() {
  const st = await chrome.runtime.sendMessage({ type: 'status' });
  $('idle').hidden = st.running;
  $('running').hidden = !st.running;
  if (st.running) {
    $('pct').textContent = st.progress + '%';
    $('fill').style.width = st.progress + '%';
  }
  return st;
}

(async () => {
  const { delay, lastError } = await chrome.storage.local.get(['delay', 'lastError']);
  if (delay) $('delay').value = String(delay);
  if (lastError) showError(lastError);

  const st = await refresh();
  if (st.running) setInterval(refresh, 500);
})();

$('delay').addEventListener('change', () => {
  chrome.storage.local.set({ delay: Number($('delay').value) });
});

$('start').addEventListener('click', async () => {
  showError('');
  $('start').disabled = true;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const res = await chrome.runtime.sendMessage({ type: 'start', tabId: tab.id });
  if (res && res.ok) {
    window.close(); // o progresso aparece no ícone da extensão
  } else {
    $('start').disabled = false;
    showError((res && res.error) || 'Erro desconhecido.');
  }
});

$('cancel').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'cancel' });
  window.close();
});
