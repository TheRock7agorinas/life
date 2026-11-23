// Keeps everything in this browser's storage. Used when no database is configured.
const KEY = 'life.budget.v1';

function read() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.categories) && Array.isArray(d.transactions)) return { vault: {}, vaultEntries: [], subscriptions: [], ...d };
  } catch { /* fall through to empty */ }
  return { categories: [], transactions: [], vault: {}, vaultEntries: [], subscriptions: [] };
}

function write(d) {
  localStorage.setItem(KEY, JSON.stringify(d));
}

function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) list.push(item); else list[i] = item;
}

export function create() {
  return {
    async load() { return read(); },
    async saveCategory(c) { const d = read(); upsert(d.categories, c); write(d); },
    async removeCategory(id) { const d = read(); d.categories = d.categories.filter((c) => c.id !== id); write(d); },
    async saveTransaction(t) { const d = read(); upsert(d.transactions, t); write(d); },
    async removeTransaction(id) { const d = read(); d.transactions = d.transactions.filter((t) => t.id !== id); write(d); },
    async saveVaultSettings(v) { const d = read(); d.vault = v; write(d); },
    async saveVaultEntry(e) { const d = read(); upsert(d.vaultEntries, e); write(d); },
    async removeVaultEntry(id) { const d = read(); d.vaultEntries = d.vaultEntries.filter((e) => e.id !== id); write(d); },
    async saveSubscription(s) { const d = read(); upsert(d.subscriptions, s); write(d); },
    async removeSubscription(id) { const d = read(); d.subscriptions = d.subscriptions.filter((s) => s.id !== id); write(d); },
  };
}
