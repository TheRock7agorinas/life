import { monthSummary, categoriesOf, vaultSummary, monthHistory } from '../store.js?v=202611231403';
import { icon } from '../icons.js?v=202611231403';
import { esc, money, moneyShort, todayISO, monthOf, shiftMonth, monthLabel, dayLabel, shortDate, fromISO } from '../ui.js?v=202611231403';
import { txnRow } from './home.js?v=202611231403';
import { summaryTile as subscriptionsTile } from './subscriptions.js?v=202611231403';
import * as vault from './vault.js?v=202611231403';

let month = monthOf(todayISO());

export function shift(by) { month = shiftMonth(month, by); }
export function setMonth(m) { month = m; }

export const budgetNav = (active) => `
  <nav class="subnav" aria-label="Budget sections">
    <a href="#/budget" ${active === 'overview' ? 'aria-current="page"' : ''}>Overview</a>
    <a href="#/subscriptions" ${active === 'subscriptions' ? 'aria-current="page"' : ''}>Subscriptions</a>
  </nav>`;
export const currentMonth = () => month;

const shortMonth = (mm) => fromISO(mm + '-01').toLocaleDateString('en-GB', { month: 'short' });
const signed = (cents) => (cents < 0 ? '−' : '') + money(Math.abs(cents));

function historyPanel() {
  const rows = monthHistory(monthOf(todayISO()));
  const chartMonths = rows.slice(0, 12).reverse(); // oldest first, last 12 months
  const max = Math.max(1, ...chartMonths.flatMap((r) => [r.income, r.spent]));
  const withData = rows.filter((r) => r.income || r.spent || r.saved);
  const over = withData.filter((r) => r.spent > r.income).length;
  const avg = withData.length ? Math.round(withData.reduce((n, r) => n + r.spent, 0) / withData.length) : 0;
  const takeaway = !withData.length ? 'Your months will collect here as you add transactions.'
    : withData.length === 1 ? `One month so far: ${money(withData[0].spent)} spent of ${money(withData[0].income)} income.`
    : `You spend ${money(avg)} a month on average, and spent more than you earned in ${over} of ${withData.length} months.`;

  const bar = (v, cls) => `<span class="hbar ${cls}" style="height:${v ? Math.max(3, Math.round((v / max) * 100)) : 0}%"></span>`;

  return `
    <section class="panel" aria-labelledby="h-history">
      <h2 id="h-history">Monthly history <small>last ${chartMonths.length === 1 ? 'month' : `${chartMonths.length} months`}</small></h2>
      <p class="takeaway">${takeaway}</p>
      <div class="legend" aria-hidden="true"><span><i class="hbar income"></i>Income</span><span><i class="hbar spent"></i>Spent</span></div>
      <div class="hchart" role="img" aria-label="Bar chart of income and spending per month. ${takeaway}">
        ${chartMonths.map((r) => `
          <button type="button" class="hcol${r.month === month ? ' is-current' : ''}" data-action="go-month" data-month="${r.month}" aria-label="Show ${monthLabel(r.month)}">
            <span class="hbars">${bar(r.income, 'income')}${bar(r.spent, 'spent')}</span>
            <span class="hlabel">${shortMonth(r.month)}</span>
          </button>`).join('')}
      </div>
      <div class="table-wrap">
        <table class="history">
          <thead><tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Spent</th><th scope="col">Saved</th><th scope="col">Left</th></tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr${r.month === month ? ' class="is-current"' : ''}>
                <th scope="row"><button type="button" class="link" data-action="go-month" data-month="${r.month}" aria-label="Show ${monthLabel(r.month)}">${shortMonth(r.month)} ${r.month.slice(0, 4)}</button></th>
                <td data-label="Income">${money(r.income)}</td><td data-label="Spent">${money(r.spent)}</td><td data-label="Saved">${signed(r.saved)}</td><td data-label="Left" class="${r.left < 0 ? 'neg' : ''}">${signed(r.left)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}

function dayChart(m) {
  const days = new Date(fromISO(month + '-01').getFullYear(), fromISO(month + '-01').getMonth() + 1, 0).getDate();
  const totals = Array.from({ length: days }, () => 0);
  m.expenses.forEach((t) => { totals[Number(t.date.slice(8, 10)) - 1] += t.amount; });
  const max = Math.max(...totals);
  if (max === 0) return `<p class="empty">No spending in ${monthLabel(month)} yet.</p>`;

  const peak = totals.indexOf(max);
  const peakDate = `${month}-${String(peak + 1).padStart(2, '0')}`;
  const takeaway = `Your biggest day was ${shortDate(peakDate)}, with ${money(max)} spent.`;
  const today = todayISO();

  const bars = totals.map((v, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`;
    const h = v ? Math.max(4, Math.round((v / max) * 100)) : 0;
    return `<span class="bar${d === today ? ' is-today' : ''}${i === peak ? ' is-peak' : ''}" style="height:${h}%"></span>`;
  }).join('');
  const ticks = totals.map((_, i) => `<span>${i === 0 || (i + 1) % 5 === 0 ? i + 1 : ''}</span>`).join('');
  const rows = totals.map((v, i) => (v ? `<tr><td>${shortDate(`${month}-${String(i + 1).padStart(2, '0')}`)}</td><td>${money(v)}</td></tr>` : '')).join('');

  return `
    <p class="takeaway">${takeaway}</p>
    <div class="chart" role="img" aria-label="Bar chart of spending for each day of ${monthLabel(month)}. ${takeaway}">
      <div class="chart-top"><span>${moneyShort(max)}</span></div>
      <div class="bars">${bars}</div>
      <div class="ticks" aria-hidden="true">${ticks}</div>
    </div>
    <details class="as-table">
      <summary>View as table</summary>
      <table>
        <thead><tr><th scope="col">Day</th><th scope="col">Spent</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`;
}

function categoryCard({ category: c, spent }) {
  const has = c.budget > 0;
  const pct = has ? Math.min(100, Math.round((spent / c.budget) * 100)) : 0;
  const diff = c.budget - spent;
  const status = !has ? 'No limit set' : diff >= 0 ? `${money(diff)} left` : `${money(-diff)} over`;
  return `
    <li>
      <button type="button" class="cat tone-${c.color}${has && diff < 0 ? ' is-over' : ''}" data-action="edit-cat" data-id="${c.id}">
        <span class="cat-top">
          <span class="tile-icon">${icon(c.icon, 20)}</span>
          <span class="cat-name">${esc(c.name)}</span>
        </span>
        <span class="cat-figure">${money(spent)}${has ? `<small> of ${moneyShort(c.budget)}</small>` : ''}</span>
        ${has ? `<span class="meter" role="img" aria-label="${pct}% used"><span style="width:${pct}%"></span></span>` : ''}
        <span class="cat-status">${status}</span>
      </button>
    </li>`;
}

function transactionList(txns) {
  if (!txns.length) return `<p class="empty">No transactions in ${monthLabel(month)}. Use the plus button to add one.</p>`;
  const groups = [];
  txns.forEach((t) => {
    const g = groups[groups.length - 1];
    if (g && g.date === t.date) g.items.push(t); else groups.push({ date: t.date, items: [t] });
  });
  return groups.map((g) => `
    <h3 class="day">${dayLabel(g.date)}</h3>
    <ul class="rows">${g.items.map(txnRow).join('')}</ul>`).join('');
}

export function render() {
  const m = monthSummary(month);
  const hasBudget = m.budget > 0;
  const saved = vaultSummary(month).saved; // put into the vault this month, minus anything taken out
  // Without a budget: what is left of this month's income after spending and saving.
  const left = hasBudget ? m.budget - m.spent : m.income - m.spent - saved;
  const isNow = month === monthOf(todayISO());

  return `
    <header class="page-head page-head-row">
      <h1>Budget</h1>
      ${budgetNav('overview')}
    </header>

    <div class="month-row">
      <div class="month" role="group" aria-label="Month">
        <button type="button" class="icon-btn" data-action="month-prev" aria-label="Previous month">${icon('chevron-left', 20)}</button>
        <span class="month-label" aria-live="polite">${monthLabel(month)}</span>
        <button type="button" class="icon-btn" data-action="month-next" aria-label="Next month" ${isNow ? 'disabled' : ''}>${icon('chevron-right', 20)}</button>
      </div>
    </div>

    <section class="bento bento-3" aria-label="Month totals">
      <div class="tile tone-butter span-2-sm">
        <span class="tile-label">${hasBudget ? (left >= 0 ? 'Left to spend' : 'Over budget') : 'Left after spending and saving'}</span>
        <span class="figure">${left < 0 && !hasBudget ? '−' : ''}${money(Math.abs(left))}</span>
        <span class="tile-line">${hasBudget ? `of a ${moneyShort(m.budget)} monthly budget` : `${money(m.income)} in, ${money(m.spent)} spent, ${saved < 0 ? `${money(-saved)} taken out of` : `${money(saved)} put in`} the vault`}</span>
      </div>
      <div class="tile tone-pink">
        <span class="tile-label">Spent</span>
        <span class="figure figure-sm">${money(m.spent)}</span>
        <span class="tile-line">${m.expenses.length} ${m.expenses.length === 1 ? 'expense' : 'expenses'}</span>
      </div>
      <div class="tile tone-sage">
        <span class="tile-label">Income</span>
        <span class="figure figure-sm">${money(m.income)}</span>
        <span class="tile-line">this month</span>
      </div>
    </section>

    ${subscriptionsTile()}

    ${vault.render(month)}

    <section class="panel" aria-labelledby="h-days">
      <h2 id="h-days">Spending by day <small>${monthLabel(month)}</small></h2>
      ${dayChart(m)}
    </section>

    <section aria-labelledby="h-cats">
      <div class="section-row">
        <h2 class="section-title" id="h-cats">Categories</h2>
        <button type="button" class="btn btn-quiet" data-action="add-cat">${icon('plus', 16)} New category</button>
      </div>
      <ul class="cats">${m.byCategory.map(categoryCard).join('')}</ul>
      ${categoriesOf('income').length ? `
        <p class="hint">Income categories:
          ${categoriesOf('income').map((c) => `<button type="button" class="chip-btn" data-action="edit-cat" data-id="${c.id}">${esc(c.name)}</button>`).join(' ')}
        </p>` : ''}
    </section>

    <section class="panel" aria-labelledby="h-txns">
      <h2 id="h-txns">Transactions <small>${monthLabel(month)}</small></h2>
      ${transactionList(m.txns)}
    </section>

    ${historyPanel()}`;
}
