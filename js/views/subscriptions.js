// Subscriptions: things paid every month or every year. Shown under Budget.
import { state, newId, categoriesOf, categoryById, saveSubscription, removeSubscription, saveTransaction, removeTransaction,
  subscriptionStatus, chargeDateIn, monthlyCost, yearlyCost } from '../store.js?v=202611231403';
import { icon } from '../icons.js?v=202611231403';
import { esc, money, parseAmount, amountInput, todayISO, monthOf, fromISO, shortDate, openSheet, closeSheet, toast, saveFailed } from '../ui.js?v=202611231403';
import { head, showError, categoryChips } from './sheets.js?v=202611231403';
import { BRANDS } from '../brands.js?v=202611231403';
import { budgetNav } from './budget.js?v=202611231403';

// The service's logo if we know it, otherwise its first letter on the category colour.
const squash = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
export function findBrand(name) {
  const key = squash(name);
  return BRANDS.find((b) => b.aliases.some((a) => key === a || key.startsWith(a)));
}
function serviceBubble(s) {
  const b = findBrand(s.name);
  if (b) {
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(b.hex.slice(i, i + 2), 16));
    const fg = 0.299 * r + 0.587 * g + 0.114 * bl > 160 ? '#1B1A17' : '#FFFFFF';
    return `<span class="bubble brand" style="background:#${b.hex};color:${fg}" title="${esc(b.title)}"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${b.path}"/></svg></span>`;
  }
  const c = categoryById(s.categoryId);
  return `<span class="bubble monogram tone-${c ? c.color : 'sky'}" aria-hidden="true">${esc(s.name.trim().charAt(0).toUpperCase() || '?')}</span>`;
}

// "4 Nov", or "4 Nov 2027" when it is not this year.
const withYear = (d) => (d.slice(0, 4) === todayISO().slice(0, 4) ? shortDate(d) : `${shortDate(d)} ${d.slice(0, 4)}`);

const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const monthName = (m) => new Date(2026, m - 1, 1).toLocaleDateString('en-GB', { month: 'long' });
const when = (s) => (s.cycle === 'yearly' ? `every year on ${s.day} ${monthName(s.month)}` : `every month on the ${ordinal(s.day)}`);

function withStatus() {
  const today = todayISO();
  return state.subscriptions
    .map((s) => {
      const st = subscriptionStatus(s, today);
      // The next payment still to come: for a due one, the one after it.
      const upcoming = st.due ? subscriptionStatus({ ...s, handled: st.month }, today).date : st.date;
      return { s, st, upcoming };
    })
    .sort((a, b) => (a.st.due !== b.st.due ? (a.st.due ? -1 : 1) : a.st.date.localeCompare(b.st.date)));
}

// Two kinds: household bills and personal subscriptions.
export const TYPES = [
  { id: 'home', title: 'Home bills', one: 'home bill', many: 'home bills', hint: 'Rent, electricity, water, phone, internet' },
  { id: 'life', title: 'Subscriptions', one: 'subscription', many: 'subscriptions', hint: 'Streaming, cloud storage, apps' },
];
const typeOf = (s) => (s.type === 'home' ? 'home' : 'life');
const sumMonth = (list) => list.reduce((n, s) => n + monthlyCost(s), 0);

const soonest = (list) => [...list].sort((a, b) => a.upcoming.localeCompare(b.upcoming))[0];

const totals = () => ({
  month: sumMonth(state.subscriptions),
  year: state.subscriptions.reduce((n, s) => n + yearlyCost(s), 0),
  home: sumMonth(state.subscriptions.filter((s) => typeOf(s) === 'home')),
  life: sumMonth(state.subscriptions.filter((s) => typeOf(s) === 'life')),
});

// Small tile on the Budget overview.
export function summaryTile() {
  const list = withStatus();
  const due = list.filter((x) => x.st.due);
  const next = soonest(list);
  const line = !list.length ? 'Add your home bills and subscriptions'
    : due.length ? `${due.map((x) => esc(x.s.name)).join(', ')} ${due.length === 1 ? 'is' : 'are'} due`
    : next ? `Next: ${esc(next.s.name)} on ${shortDate(next.upcoming)}` : '';
  return `
    <section class="bento" aria-label="Subscriptions">
      <a class="tile tone-sky span-all tile-subs" href="#/subscriptions">
        <span class="tile-icon">${icon('receipt', 22)}</span>
        <span class="tile-subs-main">
          <span class="tile-label">Bills and subscriptions</span>
          <span class="figure figure-sm">${list.length ? `${money(totals().month)} <small>a month</small>` : 'None yet'}</span>
          <span class="tile-line">${line}</span>
        </span>
        ${due.length ? `<span class="badge">${due.length} due</span>` : ''}
        <span class="tile-subs-go">${icon('chevron-right', 20)}</span>
      </a>
    </section>`;
}

function subRow({ s, st }) {
  return `
    <li>
      <button type="button" class="row" data-action="sub-edit" data-id="${s.id}">
        ${serviceBubble(s)}
        <span class="row-main">
          <span class="row-title">${esc(s.name)}</span>
          <span class="row-sub wrap">${money(s.amount)} ${when(s)}</span>
        </span>
        <span class="row-end">
          <span class="status-pill${st.due ? ' is-due' : ''}">${st.due ? 'Due' : withYear(st.date)}</span>
          ${st.paidThisMonth ? '<span class="row-sub">Paid this month</span>' : ''}
        </span>
      </button>
    </li>`;
}

export function render() {
  const list = withStatus();
  const due = list.filter((x) => x.st.due);
  const next = soonest(list);
  const t = totals();

  return `
    <header class="page-head page-head-row">
      <h1>Budget</h1>
      ${budgetNav('subscriptions')}
    </header>

    <section class="bento bento-3" aria-label="Subscription totals">
      <div class="tile tone-sky span-2-sm">
        <span class="tile-label">Total a month</span>
        <span class="figure">${money(t.month)} <small>a month</small></span>
        <span class="tile-line">Home bills ${money(t.home)} · Subscriptions ${money(t.life)} · ${money(t.year)} a year</span>
      </div>
      <div class="tile tone-pink">
        <span class="tile-label">Due now</span>
        <span class="figure figure-sm">${due.length}</span>
        <span class="tile-line">${due.length ? money(due.reduce((n, x) => n + x.s.amount, 0)) : 'Nothing to log'}</span>
      </div>
      <div class="tile tone-butter">
        <span class="tile-label">Next payment</span>
        <span class="figure figure-sm">${next ? esc(next.s.name) : 'None'}</span>
        <span class="tile-line">${next ? `${money(next.s.amount)} on ${shortDate(next.upcoming)}` : 'Add a bill or subscription to see it'}</span>
      </div>
    </section>

    ${due.length ? `
    <section class="panel tone-panel tone-pink" aria-labelledby="h-due">
      <h2 id="h-due">Due now</h2>
      <p class="tile-line">Log adds the payment to your expenses on its date. Skip if you were not charged this time.</p>
      <ul class="sub-due">
        ${due.map(({ s, st }) => `
          <li>
            ${serviceBubble(s)}
            <span class="row-main">
              <span class="row-title">${esc(s.name)}</span>
              <span class="row-sub">${money(s.amount)} · due ${shortDate(st.date)}</span>
            </span>
            <span class="sub-due-actions">
              <button type="button" class="btn btn-on-tone" data-action="sub-log" data-id="${s.id}">${icon('check', 16)} Log ${money(s.amount)}</button>
              <button type="button" class="btn btn-ghost" data-action="sub-skip" data-id="${s.id}">Skip</button>
            </span>
          </li>`).join('')}
      </ul>
    </section>` : ''}

    ${TYPES.map((ty) => {
      const items = list.filter((x) => typeOf(x.s) === ty.id);
      return `
    <section aria-labelledby="h-subs-${ty.id}">
      <div class="section-row">
        <h2 class="section-title" id="h-subs-${ty.id}">${ty.title}${items.length ? ` <small>${money(sumMonth(items.map((x) => x.s)))} a month</small>` : ''}</h2>
        <button type="button" class="btn btn-quiet" data-action="sub-add" data-type="${ty.id}" aria-label="Add ${ty.one}">${icon('plus', 16)} Add</button>
      </div>
      <div class="panel">
        ${items.length
          ? `<ul class="rows">${items.map(subRow).join('')}</ul>`
          : `<p class="empty">No ${ty.many} yet. ${ty.hint}: add each with its price and payment day, and the app will remind you to log each payment.</p>
             <button type="button" class="btn btn-primary" data-action="sub-add" data-type="${ty.id}">${icon('plus', 16)} Add your first ${ty.one}</button>`}
      </div>
    </section>`;
    }).join('')}`;
}

// ---------- Log or skip a payment ----------

export async function logPayment(id) {
  const s = state.subscriptions.find((x) => x.id === id);
  if (!s) return;
  const st = subscriptionStatus(s, todayISO());
  const before = { ...s };
  const txn = { id: newId(), date: st.date, amount: s.amount, kind: 'expense', categoryId: s.categoryId, note: s.name, createdAt: new Date().toISOString() };
  try {
    await saveTransaction(txn);
    await saveSubscription({ ...s, handled: st.month });
    toast(`${s.name} logged`, { label: 'Undo', run: () => removeTransaction(txn.id).then(() => saveSubscription(before)).catch(saveFailed) });
  } catch { saveFailed(); }
}

export async function skipPayment(id) {
  const s = state.subscriptions.find((x) => x.id === id);
  if (!s) return;
  const st = subscriptionStatus(s, todayISO());
  const before = { ...s };
  try {
    await saveSubscription({ ...s, handled: st.month });
    toast(`${s.name} skipped this time`, { label: 'Undo', run: () => saveSubscription(before).catch(saveFailed) });
  } catch { saveFailed(); }
}

// ---------- Add / edit ----------

export function openSubscriptionSheet(id, type = 'life') {
  const existing = id ? state.subscriptions.find((x) => x.id === id) : null;
  const other = categoriesOf('expense').find((c) => c.name === 'Other') || categoriesOf('expense')[0];
  const s = existing || { id: newId(), name: '', amount: 0, cycle: 'monthly', day: 1, month: 1, categoryId: other ? other.id : '', handled: '', type, createdAt: new Date().toISOString() };
  if (!existing && type === 'home') {
    const bills = categoriesOf('expense').find((c) => c.name === 'Home & bills');
    if (bills) s.categoryId = bills.id;
  }
  const nextDate = existing ? subscriptionStatus(s, todayISO()).date : '';

  const el = openSheet(`
    <form class="form" novalidate>
      ${head(existing ? `Edit ${TYPES.find((t) => t.id === typeOf(s)).one}` : `Add ${TYPES.find((t) => t.id === typeOf(s)).one}`)}

      <fieldset class="segmented">
        <legend class="visually-hidden">Type</legend>
        <label><input type="radio" name="type" value="home" ${typeOf(s) === 'home' ? 'checked' : ''}><span>Home bill</span></label>
        <label><input type="radio" name="type" value="life" ${typeOf(s) === 'life' ? 'checked' : ''}><span>Subscription</span></label>
      </fieldset>

      <div class="field">
        <label for="s-name">Name</label>
        <input id="s-name" name="name" class="input" maxlength="40" autocomplete="off" placeholder="${typeOf(s) === 'home' ? 'For example: Rent' : 'For example: Netflix'}" value="${esc(s.name)}" ${existing ? '' : 'autofocus'}>
        <p class="help">Use the name you write on the expense, so payments you log by hand are recognised.</p>
        <p class="error" data-error="name" hidden></p>
      </div>

      <div class="field">
        <label for="s-amount">Price in euros</label>
        <input id="s-amount" name="amount" class="input input-amount" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${amountInput(s.amount)}">
        <p class="error" data-error="amount" hidden></p>
      </div>

      <fieldset class="segmented">
        <legend class="visually-hidden">How often</legend>
        <label><input type="radio" name="cycle" value="monthly" ${s.cycle === 'monthly' ? 'checked' : ''}><span>Every month</span></label>
        <label><input type="radio" name="cycle" value="yearly" ${s.cycle === 'yearly' ? 'checked' : ''}><span>Every year</span></label>
      </fieldset>

      <div class="field">
        <label for="s-date">Next payment</label>
        <input id="s-date" name="date" type="date" class="input" value="${nextDate}" aria-describedby="s-date-help">
        <p class="help" id="s-date-help" data-date-help>${existing ? `Currently ${when(s)}.` : 'The app repeats it on the same day each time.'}</p>
        <p class="error" data-error="date" hidden></p>
      </div>

      <fieldset class="field">
        <legend>Category</legend>
        <div class="chips">${categoryChips('expense', s.categoryId)}</div>
        <p class="error" data-error="categoryId" hidden></p>
      </fieldset>

      <div class="sheet-actions">
        ${existing ? `<button type="button" class="btn btn-quiet btn-danger" data-delete>${icon('trash-2', 16)} Delete</button>` : '<span></span>'}
        <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Add'}</button>
      </div>
    </form>`);

  const form = el.querySelector('form');

  // Spell out what the picked date means, e.g. "every month on the 12th".
  const explain = () => {
    const d = form.elements.date.value;
    if (!d) return;
    const dt = fromISO(d);
    form.querySelector('[data-date-help]').textContent = `Repeats ${when({ cycle: new FormData(form).get('cycle'), day: dt.getDate(), month: dt.getMonth() + 1 })}.`;
  };
  form.addEventListener('change', explain);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    const amount = parseAmount(data.get('amount'));
    const date = data.get('date');
    const categoryId = data.get('categoryId');

    showError(form, 'categoryId', categoryId ? '' : 'Pick a category.');
    showError(form, 'date', date ? '' : 'Pick the date of the next payment.');
    showError(form, 'amount', amount ? '' : 'Type the price, for example 12.99');
    showError(form, 'name', name ? '' : 'Give it a name.');
    if (!name || !amount || !date || !categoryId) return;

    const dt = fromISO(date);
    const next = { ...s, name, amount, cycle: data.get('cycle'), day: dt.getDate(), month: dt.getMonth() + 1, categoryId, type: data.get('type') === 'home' ? 'home' : 'life' };
    // If the next payment is in the future, this month's earlier payment (if any) is
    // already behind you, so do not ask to log it.
    const today = todayISO();
    const thisMonth = monthOf(today);
    const thisDate = chargeDateIn(next, thisMonth);
    if (date > today && thisDate && thisDate < date && monthOf(date) !== thisMonth) next.handled = thisMonth;

    closeSheet();
    try {
      await saveSubscription(next);
      toast(existing ? 'Changes saved' : `${name} added`);
    } catch { saveFailed(); }
  });

  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    closeSheet();
    try {
      await removeSubscription(s.id);
      toast(`${s.name} deleted`, { label: 'Undo', run: () => saveSubscription(s).catch(saveFailed) });
    } catch { saveFailed(); }
  });
}
