// One place for all data. Screens read `state` and call the functions below;
// where the data is kept (this device or the database) is the adapter's job.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=202611231403';

export const state = {
  ready: false,
  mode: 'local',      // 'local' = this device only, 'cloud' = database with login
  user: null,         // { email } when signed in
  categories: [],     // { id, name, kind, color, icon, budget (cents per month), sort }
  transactions: [],   // { id, date 'YYYY-MM-DD', amount (cents), kind, categoryId, note, createdAt }
  vault: { salary: 0, goal: 0, starting: 0 }, // cents: monthly salary, monthly saving goal, savings held before using the app
  vaultEntries: [],   // { id, date, amount (cents, negative = taken out), note, createdAt }
  subscriptions: [],  // { id, name, amount (cents), cycle 'monthly'|'yearly', day 1-31, month 1-12, categoryId, handled 'YYYY-MM', type 'home'|'life', createdAt }
};

export const TONES = ['butter', 'pink', 'sage', 'sky', 'lavender', 'peach'];

const DEFAULT_CATEGORIES = [
  ['Groceries', 'expense', 'sage', 'shopping-basket'],
  ['Eating out', 'expense', 'peach', 'utensils'],
  ['Home & bills', 'expense', 'butter', 'zap'],
  ['Transport', 'expense', 'sky', 'bus'],
  ['Health', 'expense', 'pink', 'heart-pulse'],
  ['Fun & games', 'expense', 'lavender', 'gamepad-2'],
  ['Shopping', 'expense', 'pink', 'shopping-bag'],
  ['Travel', 'expense', 'sky', 'plane'],
  ['Other', 'expense', 'butter', 'ellipsis'],
  ['Salary', 'income', 'sage', 'banknote'],
  ['Other income', 'income', 'lavender', 'coins'],
];

let adapter = null;
const listeners = new Set();

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn()); }

export const newId = () => crypto.randomUUID();

export async function init() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    state.mode = 'cloud';
    const { create } = await import('./adapters/supabase.js?v=202611231403');
    adapter = await create(SUPABASE_URL, SUPABASE_ANON_KEY);
    state.user = await adapter.user();
    if (!state.user) { state.ready = true; emit(); return; }
  } else {
    const { create } = await import('./adapters/local.js?v=202611231403');
    adapter = create();
  }
  await reload();
}

async function reload() {
  const data = await adapter.load();
  state.categories = data.categories;
  state.transactions = data.transactions;
  state.vault = { salary: 0, goal: 0, starting: 0, ...data.vault };
  state.vaultEntries = data.vaultEntries || [];
  state.subscriptions = data.subscriptions || [];
  if (!state.categories.length) {
    state.categories = DEFAULT_CATEGORIES.map(([name, kind, color, icon], sort) => ({ id: newId(), name, kind, color, icon, budget: 0, sort }));
    for (const c of state.categories) await adapter.saveCategory(c);
  }
  state.ready = true;
  emit();
}

export async function signIn(email, password) {
  state.user = await adapter.signIn(email, password);
  await reload();
}

export async function signOut() {
  await adapter.signOut();
  state.user = null;
  state.categories = [];
  state.transactions = [];
  state.vault = { salary: 0, goal: 0, starting: 0 };
  state.vaultEntries = [];
  state.subscriptions = [];
  emit();
}

// Change the screen at once, then save. If saving fails, put things back.
async function commit(apply, save) {
  const before = { ...state };
  apply();
  emit();
  try {
    await save();
  } catch (err) {
    Object.assign(state, before);
    emit();
    throw err;
  }
}

const withItem = (list, item) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);

export function saveTransaction(t) {
  return commit(() => { state.transactions = withItem(state.transactions, t); }, () => adapter.saveTransaction(t));
}
export function removeTransaction(id) {
  return commit(() => { state.transactions = state.transactions.filter((t) => t.id !== id); }, () => adapter.removeTransaction(id));
}
export function saveCategory(c) {
  return commit(() => { state.categories = withItem(state.categories, c); }, () => adapter.saveCategory(c));
}
export function removeCategory(id) {
  return commit(() => { state.categories = state.categories.filter((c) => c.id !== id); }, () => adapter.removeCategory(id));
}

export function saveVaultSettings(v) {
  return commit(() => { state.vault = v; }, () => adapter.saveVaultSettings(v));
}
export function saveVaultEntry(e) {
  return commit(() => { state.vaultEntries = withItem(state.vaultEntries, e); }, () => adapter.saveVaultEntry(e));
}
export function removeVaultEntry(id) {
  return commit(() => { state.vaultEntries = state.vaultEntries.filter((e) => e.id !== id); }, () => adapter.removeVaultEntry(id));
}

export function saveSubscription(s) {
  return commit(() => { state.subscriptions = withItem(state.subscriptions, s); }, () => adapter.saveSubscription(s));
}
export function removeSubscription(id) {
  return commit(() => { state.subscriptions = state.subscriptions.filter((s) => s.id !== id); }, () => adapter.removeSubscription(id));
}

// ---------- Reading helpers ----------

export const categoryById = (id) => state.categories.find((c) => c.id === id);
export const categoriesOf = (kind) => state.categories.filter((c) => c.kind === kind).sort((a, b) => a.sort - b.sort);
export const sum = (list) => list.reduce((n, t) => n + t.amount, 0);

export function transactionsIn(month) { // month = 'YYYY-MM'
  return state.transactions
    .filter((t) => t.date.startsWith(month))
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : (a.date < b.date ? 1 : -1)));
}

export function monthSummary(month) {
  const txns = transactionsIn(month);
  const expenses = txns.filter((t) => t.kind === 'expense');
  const spent = sum(expenses);
  const income = sum(txns.filter((t) => t.kind === 'income'));
  const budget = categoriesOf('expense').reduce((n, c) => n + c.budget, 0);
  const byCategory = categoriesOf('expense').map((c) => ({ category: c, spent: sum(expenses.filter((t) => t.categoryId === c.id)) }));
  return { txns, expenses, spent, income, budget, byCategory };
}

export const vaultBalance = () => state.vault.starting + sum(state.vaultEntries);

export function vaultSummary(month) {
  const entries = [...state.vaultEntries].sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : (a.date < b.date ? 1 : -1)));
  const saved = sum(entries.filter((e) => e.date.startsWith(month)));
  const { goal, salary } = state.vault;
  return { entries, saved, goal, salary, balance: vaultBalance(), toGo: Math.max(0, goal - saved), reached: goal > 0 && saved >= goal };
}

// Every month with any income, spending or savings, newest first, plus the current month.
export function monthHistory(current) {
  const months = new Set([current]);
  state.transactions.forEach((t) => months.add(t.date.slice(0, 7)));
  state.vaultEntries.forEach((e) => months.add(e.date.slice(0, 7)));
  return [...months].sort().reverse().map((month) => {
    const m = monthSummary(month);
    const saved = vaultSummary(month).saved;
    return { month, income: m.income, spent: m.spent, saved, left: m.income - m.spent - saved };
  });
}

// ---------- Subscriptions ----------

const pad2 = (n) => String(n).padStart(2, '0');
const daysIn = (month) => { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const addMonths = (month, by) => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + by, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };

// The payment date in a given month ('YYYY-MM'), or null if there is none that month.
// A payment day the month does not have (31st in November) falls on the month's last day.
export function chargeDateIn(s, month) {
  if (s.cycle === 'yearly' && Number(month.slice(5, 7)) !== s.month) return null;
  return `${month}-${pad2(Math.min(s.day, daysIn(month)))}`;
}

// True when this month's payment is already in the transactions: logged from here,
// skipped, or typed in by hand with the subscription's name in the note.
export function subscriptionPaid(s, month) {
  if (s.handled === month) return true;
  const name = s.name.trim().toLowerCase();
  return transactionsIn(month).some((t) => t.kind === 'expense' && t.note.toLowerCase().includes(name));
}

// { due: bool, date: next or overdue payment date, month: that payment's month, paidThisMonth }
export function subscriptionStatus(s, today) {
  const now = today.slice(0, 7);
  const thisDate = chargeDateIn(s, now);
  const paidThisMonth = thisDate ? subscriptionPaid(s, now) : false;
  if (thisDate && thisDate <= today && !paidThisMonth) return { due: true, date: thisDate, month: now, paidThisMonth };
  if (thisDate && thisDate > today) return { due: false, date: thisDate, month: now, paidThisMonth };
  let month = addMonths(now, 1);
  while (!chargeDateIn(s, month)) month = addMonths(month, 1); // yearly: walk forward to its month
  return { due: false, date: chargeDateIn(s, month), month, paidThisMonth };
}

export const monthlyCost = (s) => (s.cycle === 'yearly' ? Math.round(s.amount / 12) : s.amount);
export const yearlyCost = (s) => (s.cycle === 'yearly' ? s.amount : s.amount * 12);
