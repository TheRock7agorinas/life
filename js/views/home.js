import { state, monthSummary, categoryById, sum } from '../store.js?v=202611231403';
import { icon } from '../icons.js?v=202611231403';
import { homeTile as vaultTile } from './vault.js?v=202611231403';
import { esc, money, moneyShort, todayISO, monthOf, iso, shortDate, monthLabel } from '../ui.js?v=202611231403';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function weekStartISO() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return iso(d);
}

export function txnRow(t) {
  const c = categoryById(t.categoryId);
  const title = t.note || (c ? c.name : 'Transaction');
  const sign = t.kind === 'income' ? '+' : '−';
  return `
    <li>
      <button type="button" class="row" data-action="edit-txn" data-id="${t.id}">
        <span class="bubble tone-${c ? c.color : 'butter'}">${icon(c ? c.icon : 'ellipsis', 18)}</span>
        <span class="row-main">
          <span class="row-title">${esc(title)}</span>
          <span class="row-sub">${esc(c ? c.name : 'No category')} · ${shortDate(t.date)}</span>
        </span>
        <span class="row-amount ${t.kind}">${sign}${money(t.amount)}</span>
      </button>
    </li>`;
}

export function render() {
  const today = todayISO();
  const month = monthOf(today);
  const m = monthSummary(month);
  const spentToday = sum(m.expenses.filter((t) => t.date === today));
  const week = weekStartISO();
  const spentWeek = sum(state.transactions.filter((t) => t.kind === 'expense' && t.date >= week && t.date <= today));
  const top = [...m.byCategory].sort((a, b) => b.spent - a.spent)[0];
  const recent = m.txns.slice(0, 4);

  const hasBudget = m.budget > 0;
  const left = m.budget - m.spent;
  const pct = hasBudget ? Math.min(100, Math.round((m.spent / m.budget) * 100)) : 0;

  const budgetTile = hasBudget
    ? `<span class="tile-label">${left >= 0 ? 'Left this month' : 'Over budget this month'}</span>
       <span class="figure">${money(Math.abs(left))}</span>
       <span class="meter" role="img" aria-label="${pct}% of the budget spent"><span style="width:${pct}%"></span></span>
       <span class="tile-line">${money(m.spent)} spent of ${moneyShort(m.budget)}</span>`
    : `<span class="tile-label">Spent this month</span>
       <span class="figure">${money(m.spent)}</span>
       <span class="tile-line">No monthly budget yet. Open Budget and pick a category to set one.</span>`;

  return `
    <header class="page-head">
      <p class="eyebrow">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>${greeting()}</h1>
    </header>

    <section class="bento" aria-label="Overview">
      <a class="tile tone-butter span-2 tile-hero" href="#/budget">
        <span class="tile-icon">${icon('wallet', 22)}</span>
        ${budgetTile}
      </a>

      <div class="tile tone-pink">
        <span class="tile-label">Today</span>
        <span class="figure figure-sm">${money(spentToday)}</span>
        <span class="tile-line">spent</span>
      </div>

      <div class="tile tone-sky">
        <span class="tile-label">This week</span>
        <span class="figure figure-sm">${money(spentWeek)}</span>
        <span class="tile-line">since Monday</span>
      </div>

      <div class="tile tile-plain span-2 tall">
        <div class="tile-headline">
          <h2>Latest</h2>
          <a class="link" href="#/budget">See all</a>
        </div>
        ${recent.length
          ? `<ul class="rows">${recent.map(txnRow).join('')}</ul>`
          : `<p class="empty">Nothing logged in ${monthLabel(month)} yet. Use the plus button to add your first expense.</p>`}
      </div>

      <div class="tile tone-sage">
        <span class="tile-label">Top category</span>
        ${top && top.spent > 0
          ? `<span class="figure figure-sm">${esc(top.category.name)}</span><span class="tile-line">${money(top.spent)} this month</span>`
          : `<span class="figure figure-sm">None yet</span><span class="tile-line">shows after your first expense</span>`}
      </div>

      <div class="tile tone-peach">
        <span class="tile-label">Income</span>
        <span class="figure figure-sm">${money(m.income)}</span>
        <span class="tile-line">this month</span>
      </div>

      ${vaultTile()}
    </section>

    <h2 class="section-title">Your life</h2>
    <section class="bento" aria-label="Sections">
      <a class="tile tone-butter tile-module" href="#/budget">
        <span class="tile-icon">${icon('wallet', 22)}</span>
        <span class="tile-name">Budget</span>
        <span class="tile-line">Spending and monthly limits</span>
      </a>
      <a class="tile tone-pink tile-module" href="#/subscriptions">
        <span class="tile-icon">${icon('receipt', 22)}</span>
        <span class="tile-name">Subscriptions</span>
        <span class="tile-line">Monthly and yearly payments</span>
      </a>
    </section>`;
}
