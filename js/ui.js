// Small shared helpers: escaping, money, dates, the sheet and the toast.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const eurWhole = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const money = (cents) => eur.format(cents / 100);
export const moneyShort = (cents) => (cents % 100 === 0 ? eurWhole.format(cents / 100) : eur.format(cents / 100));

// "12", "12.5", "12,50" -> cents. Anything else -> null.
export function parseAmount(text) {
  const s = String(text).trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}
export const amountInput = (cents) => (cents ? (cents / 100).toFixed(2).replace(/\.00$/, '') : '');

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => iso(new Date());
export const monthOf = (isoDate) => isoDate.slice(0, 7);
export const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };

export function shiftMonth(month, by) {
  const d = fromISO(month + '-01');
  d.setMonth(d.getMonth() + by);
  return monthOf(iso(d));
}
export const monthLabel = (month) => fromISO(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
export const dayLabel = (isoDate) => {
  if (isoDate === todayISO()) return 'Today';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (isoDate === iso(y)) return 'Yesterday';
  return fromISO(isoDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};
export const shortDate = (isoDate) => fromISO(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// ---------- Sheet (bottom sheet on phones, dialog on desktop) ----------

const sheet = () => document.getElementById('sheet');

export function openSheet(html) {
  const el = sheet();
  el.innerHTML = html;
  if (!el.open) el.showModal();
  const first = el.querySelector('[autofocus]');
  if (first) first.focus();
  return el;
}
export function closeSheet() {
  const el = sheet();
  if (el.open) el.close();
  el.innerHTML = '';
}

// ---------- Toast, with an optional action such as Undo ----------

let toastTimer = null;
export function toast(message, action) {
  const el = document.getElementById('toast');
  clearTimeout(toastTimer);
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" class="toast-action">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  if (action) {
    el.querySelector('.toast-action').addEventListener('click', () => { el.hidden = true; action.run(); });
  }
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 8000 : 4000);
}

export const saveFailed = () => toast('That did not save. Check your connection and try again.');
