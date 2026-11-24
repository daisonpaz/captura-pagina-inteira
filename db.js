// Pequeno armazenamento em IndexedDB, compartilhado entre o service worker e a página de resultado.
const FPC_DB = (() => {
  const NAME = 'captura-pagina-inteira';
  const STORE = 'jobs';

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let result;
      Promise.resolve(fn(store)).then((r) => { result = r; });
      t.oncomplete = () => { db.close(); resolve(result); };
      t.onerror = () => { db.close(); reject(t.error); };
    });
  }

  function reqP(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    put: (key, value) => tx('readwrite', (s) => { s.put(value, key); }),
    get: (key) => tx('readonly', (s) => reqP(s.get(key))),
    clear: () => tx('readwrite', (s) => { s.clear(); }),
  };
})();
