// The vault: savings inside the Budget section.
import { state, newId, vaultSummary, vaultBalance, categoriesOf, saveVaultSettings, saveVaultEntry, removeVaultEntry } from '../store.js?v=202611231403';
import { icon } from '../icons.js?v=202611231403';
import { esc, money, moneyShort, parseAmount, amountInput, todayISO, monthOf, monthLabel, shortDate, fromISO, openSheet, closeSheet, toast, saveFailed } from '../ui.js?v=202611231403';
import { head, showError } from './sheets.js?v=202611231403';

// Share of the salary offered as a monthly saving goal. 20% is the saving part
// of the common 50/30/20 budgeting rule of thumb; 10% and 15% are gentler starts.
const SHARES = [10, 15, 20];
const SUGGESTED = 20;
const share = (salary, pct) => Math.round((salary * pct) / 10000) * 100; // whole euros

const monthName = (month) => fromISO(month + '-01').toLocaleDateString('en-GB', { month: 'long' });

function reminder(v, month) {
  if (!v.goal) {
    return v.salary
      ? `Suggested for your salary: ${moneyShort(share(v.salary, SUGGESTED))} a month. Open "Salary and goal" to use it or pick your own.`
      : 'Add your salary under "Salary and goal" to get a suggested amount to save each month.';
  }
  if (v.reached) return `You reached your ${monthName(month)} goal.`;
  if (month !== monthOf(todayISO())) return `${money(v.toGo)} short of the goal that month.`;
  const now = new Date();
  const left = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const days = left === 0 ? 'Today is the last day.' : left === 1 ? '1 day left.' : `${left} days left.`;
  return `${money(v.toGo)} still to save this month. ${days}`;
}

const needsReminder = (v, month) => v.goal > 0 && !v.reached && month === monthOf(todayISO());

function entryRow(e) {
  const added = e.amount > 0;
  return `
    <li>
      <button type="button" class="row" data-action="vault-edit" data-id="${e.id}">
        <span class="bubble tone-lavender">${icon(added ? 'arrow-down-left' : 'arrow-up-right', 18)}</span>
        <span class="row-main">
          <span class="row-title">${esc(e.note || (added ? 'Added to vault' : 'Taken out'))}</span>
          <span class="row-sub">${added ? 'Added' : 'Taken out'} · ${shortDate(e.date)}</span>
        </span>
        <span class="row-amount">${added ? '+' : '−'}${money(Math.abs(e.amount))}</span>
      </button>
    </li>`;
}

// Tile for the home screen.
export function homeTile() {
  const month = monthOf(todayISO());
  const v = vaultSummary(month);
  return `
    <a class="tile tone-lavender span-2" href="#/budget">
      <span class="tile-icon">${icon('piggy-bank', 22)}</span>
      <span class="tile-label">In your vault</span>
      <span class="figure figure-sm">${money(v.balance)}</span>
      <span class="tile-line">${reminder(v, month)}</span>
      ${needsReminder(v, month) ? '<span class="badge">Reminder</span>' : ''}
    </a>`;
}

// Section inside the Budget screen.
export function render(month) {
  const v = vaultSummary(month);
  const pct = v.goal ? Math.min(100, Math.max(0, Math.round((v.saved / v.goal) * 100))) : 0;
  const recent = v.entries.slice(0, 5);

  return `
    <section aria-labelledby="h-vault">
      <div class="section-row">
        <h2 class="section-title" id="h-vault">Vault</h2>
        <button type="button" class="btn btn-quiet" data-action="vault-settings">${icon('target', 16)} Salary and goal</button>
      </div>
      <div class="bento">
        <div class="tile tone-lavender span-2 tile-vault">
          <span class="tile-icon">${icon('piggy-bank', 22)}</span>
          <span class="tile-label">In your vault</span>
          <span class="figure">${money(v.balance)}</span>
          <span class="tile-actions">
            <button type="button" class="btn btn-on-tone" data-action="vault-add">${icon('plus', 16)} Add money</button>
            <button type="button" class="btn btn-ghost" data-action="vault-take" ${v.balance > 0 ? '' : 'disabled'}>Take out</button>
          </span>
        </div>
        <div class="tile tone-butter span-2">
          <span class="tile-label">Saved in ${monthLabel(month)}</span>
          <span class="figure figure-sm">${v.saved < 0 ? '−' : ''}${money(Math.abs(v.saved))}${v.goal ? `<small> of ${moneyShort(v.goal)}</small>` : ''}</span>
          ${v.goal ? `<span class="meter" role="img" aria-label="${pct}% of the monthly goal saved"><span style="width:${pct}%"></span></span>` : ''}
          <span class="tile-line">${reminder(v, month)}</span>
          ${needsReminder(v, month) ? '<span class="badge">Reminder</span>' : ''}
        </div>
        ${recent.length ? `
        <div class="tile tile-plain span-all">
          <div class="tile-headline"><h2>Vault activity</h2></div>
          <ul class="rows">${recent.map(entryRow).join('')}</ul>
        </div>` : ''}
      </div>
    </section>`;
}

// ---------- Add money / take out ----------

export function openVaultEntrySheet(id, direction = 'in') {
  const existing = id ? state.vaultEntries.find((e) => e.id === id) : null;
  const e = existing || { id: newId(), date: todayISO(), amount: 0, note: '', createdAt: new Date().toISOString() };
  const dir = existing ? (e.amount > 0 ? 'in' : 'out') : direction;
  const available = vaultBalance() - (existing ? e.amount : 0); // balance without this entry

  const el = openSheet(`
    <form class="form" novalidate>
      ${head(existing ? 'Edit vault entry' : 'Vault')}

      <fieldset class="segmented">
        <legend class="visually-hidden">Direction</legend>
        <label><input type="radio" name="dir" value="in" ${dir === 'in' ? 'checked' : ''}><span>Add money</span></label>
        <label><input type="radio" name="dir" value="out" ${dir === 'out' ? 'checked' : ''}><span>Take out</span></label>
      </fieldset>

      <div class="field">
        <label for="v-amount">Amount in euros</label>
        <input id="v-amount" name="amount" class="input input-amount" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${amountInput(Math.abs(e.amount))}" aria-describedby="v-amount-help" ${existing ? '' : 'autofocus'}>
        <p class="help" id="v-amount-help">You have ${money(available)} in the vault${existing ? ' without this entry' : ''}.</p>
        <p class="error" data-error="amount" hidden></p>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="v-date">Date</label>
          <input id="v-date" name="date" type="date" class="input" value="${e.date}" max="${todayISO()}" required>
          <p class="error" data-error="date" hidden></p>
        </div>
        <div class="field">
          <label for="v-note">Note <span class="optional">optional</span></label>
          <input id="v-note" name="note" class="input" maxlength="80" autocomplete="off" placeholder="For example: from salary" value="${esc(e.note)}">
        </div>
      </div>

      <div class="sheet-actions">
        ${existing ? `<button type="button" class="btn btn-quiet btn-danger" data-delete>${icon('trash-2', 16)} Delete</button>` : '<span></span>'}
        <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Save'}</button>
      </div>
    </form>`);

  const form = el.querySelector('form');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const data = new FormData(form);
    const amount = parseAmount(data.get('amount'));
    const out = data.get('dir') === 'out';
    const date = data.get('date');

    const dateError = !date ? 'Pick the day this happened.' : date > todayISO() ? 'This date is in the future. Pick today or earlier.' : '';
    const amountError = !amount ? 'Type an amount above zero, for example 50'
      : out && amount > available ? `You can take out ${money(available)} at most.` : '';
    showError(form, 'date', dateError);
    showError(form, 'amount', amountError);
    if (dateError || amountError) return;

    closeSheet();
    try {
      await saveVaultEntry({ ...e, amount: out ? -amount : amount, date, note: String(data.get('note')).trim() });
      toast(existing ? 'Changes saved' : out ? `${money(amount)} taken out` : `${money(amount)} added to your vault`);
    } catch { saveFailed(); }
  });

  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    closeSheet();
    try {
      await removeVaultEntry(e.id);
      toast('Vault entry deleted', { label: 'Undo', run: () => saveVaultEntry(e).catch(saveFailed) });
    } catch { saveFailed(); }
  });
}

// ---------- Salary and goal ----------

function suggestions(salary) {
  if (!salary) return '<p class="help">Type your salary above to see suggested amounts.</p>';
  const limits = categoriesOf('expense').reduce((n, c) => n + c.budget, 0);
  return `
    <p class="help">Pick one to use it as your goal, or type your own below.</p>
    <div class="chips">
      ${SHARES.map((pct) => `<button type="button" class="chip-btn" data-goal="${amountInput(share(salary, pct))}">${moneyShort(share(salary, pct))} <span class="optional">${pct}%${pct === SUGGESTED ? ', suggested' : ''}</span></button>`).join('')}
    </div>
    <p class="help">20% is the saving share in the common 50/30/20 rule of thumb (50% needs, 30% wants, 20% savings). It is a starting point, not financial advice: go lower if your fixed costs are high.</p>
    ${limits ? `<p class="help">Your category limits add up to ${moneyShort(limits)}, which leaves ${limits <= salary ? moneyShort(salary - limits) : 'nothing'} of your salary.</p>` : ''}`;
}

export function openVaultSettingsSheet() {
  const v = state.vault;

  const el = openSheet(`
    <form class="form" novalidate>
      ${head('Salary and goal')}

      <div class="field">
        <label for="vs-salary">Monthly salary in euros</label>
        <input id="vs-salary" name="salary" class="input" inputmode="decimal" autocomplete="off" placeholder="0" value="${amountInput(v.salary)}" aria-describedby="vs-salary-help" ${v.salary ? '' : 'autofocus'}>
        <p class="help" id="vs-salary-help">What reaches your account each month, after tax. Only used to suggest how much to save.</p>
        <p class="error" data-error="salary" hidden></p>
      </div>

      <fieldset class="field suggest">
        <legend>Suggested monthly saving</legend>
        <div data-suggest>${suggestions(v.salary)}</div>
      </fieldset>

      <div class="field">
        <label for="vs-goal">Your monthly saving goal in euros</label>
        <input id="vs-goal" name="goal" class="input" inputmode="decimal" autocomplete="off" placeholder="No goal" value="${amountInput(v.goal)}" aria-describedby="vs-goal-help">
        <p class="help" id="vs-goal-help">The vault reminds you each month until you have saved this much.</p>
        <p class="error" data-error="goal" hidden></p>
      </div>

      <div class="field">
        <label for="vs-starting">Already saved <span class="optional">optional</span></label>
        <input id="vs-starting" name="starting" class="input" inputmode="decimal" autocomplete="off" placeholder="0" value="${amountInput(v.starting)}" aria-describedby="vs-starting-help">
        <p class="help" id="vs-starting-help">Savings you had before using the vault. Counted in your total, not toward a monthly goal.</p>
        <p class="error" data-error="starting" hidden></p>
      </div>

      <div class="sheet-actions">
        <span></span>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`);

  const form = el.querySelector('form');
  const optional = (text) => (String(text).trim() ? parseAmount(text) : 0);

  form.elements.salary.addEventListener('input', () => {
    form.querySelector('[data-suggest]').innerHTML = suggestions(optional(form.elements.salary.value) || 0);
  });

  form.addEventListener('click', (ev) => {
    const chip = ev.target.closest('[data-goal]');
    if (!chip) return;
    form.elements.goal.value = chip.dataset.goal;
    form.elements.goal.focus();
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const salary = optional(form.elements.salary.value);
    const goal = optional(form.elements.goal.value);
    const starting = optional(form.elements.starting.value);

    showError(form, 'starting', starting === null ? 'Type a number, for example 2000' : '');
    showError(form, 'goal', goal === null ? 'Type a number, for example 300' : '');
    showError(form, 'salary', salary === null ? 'Type a number, for example 1800' : '');
    if (salary === null || goal === null || starting === null) return;

    closeSheet();
    try {
      await saveVaultSettings({ salary, goal, starting });
      toast('Vault updated');
    } catch { saveFailed(); }
  });
}
