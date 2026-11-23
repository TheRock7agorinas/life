// The add / edit sheets for transactions and categories.
import { state, TONES, newId, categoriesOf, categoryById, saveTransaction, removeTransaction, saveCategory, removeCategory } from '../store.js?v=202611231403';
import { icon } from '../icons.js?v=202611231403';
import { esc, parseAmount, amountInput, todayISO, openSheet, closeSheet, toast, saveFailed } from '../ui.js?v=202611231403';

const ICONS = ['shopping-basket', 'utensils', 'zap', 'house', 'bus', 'plane', 'heart-pulse', 'dumbbell', 'gamepad-2', 'shopping-bag', 'gift', 'sparkles', 'receipt', 'piggy-bank', 'banknote', 'coins', 'ellipsis'];

export const head = (title) => `
  <div class="sheet-head">
    <h2 id="sheet-title">${title}</h2>
    <button type="button" class="icon-btn" data-close aria-label="Close">${icon('x', 20)}</button>
  </div>`;

export function showError(form, name, message) {
  const p = form.querySelector(`[data-error="${name}"]`);
  p.textContent = message;
  p.hidden = !message;
  const field = form.elements[name];
  if (field && field.setAttribute) field.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (message && field && field.focus) field.focus();
}

// ---------- Transaction ----------

export const categoryChips = (kind, selected) => categoriesOf(kind).map((c) => `
  <label class="chip tone-${c.color}">
    <input type="radio" name="categoryId" value="${c.id}" ${c.id === selected ? 'checked' : ''}>
    <span>${icon(c.icon, 16)} ${esc(c.name)}</span>
  </label>`).join('');

export function openTransactionSheet(id) {
  const existing = id ? state.transactions.find((t) => t.id === id) : null;
  const t = existing || { id: newId(), date: todayISO(), amount: 0, kind: 'expense', categoryId: '', note: '', createdAt: new Date().toISOString() };

  const el = openSheet(`
    <form class="form" novalidate>
      ${head(existing ? 'Edit transaction' : 'Add transaction')}

      <fieldset class="segmented">
        <legend class="visually-hidden">Type</legend>
        <label><input type="radio" name="kind" value="expense" ${t.kind === 'expense' ? 'checked' : ''}><span>Expense</span></label>
        <label><input type="radio" name="kind" value="income" ${t.kind === 'income' ? 'checked' : ''}><span>Income</span></label>
      </fieldset>

      <div class="field">
        <label for="f-amount">Amount in euros</label>
        <input id="f-amount" name="amount" class="input input-amount" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${amountInput(t.amount)}" aria-describedby="e-amount" ${existing ? '' : 'autofocus'}>
        <p class="error" id="e-amount" data-error="amount" hidden></p>
      </div>

      <fieldset class="field">
        <legend>Category</legend>
        <div class="chips" data-chips>${categoryChips(t.kind, t.categoryId)}</div>
        <p class="error" data-error="categoryId" hidden></p>
      </fieldset>

      <div class="field-row">
        <div class="field">
          <label for="f-date">Date</label>
          <input id="f-date" name="date" type="date" class="input" value="${t.date}" max="${todayISO()}" required>
          <p class="error" data-error="date" hidden></p>
        </div>
        <div class="field">
          <label for="f-note">Note <span class="optional">optional</span></label>
          <input id="f-note" name="note" class="input" maxlength="80" autocomplete="off" placeholder="What was it for?" value="${esc(t.note)}">
        </div>
      </div>

      <div class="sheet-actions">
        ${existing ? `<button type="button" class="btn btn-quiet btn-danger" data-delete>${icon('trash-2', 16)} Delete</button>` : '<span></span>'}
        <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Add'}</button>
      </div>
    </form>`);

  const form = el.querySelector('form');

  form.addEventListener('change', (e) => {
    if (e.target.name === 'kind') form.querySelector('[data-chips]').innerHTML = categoryChips(e.target.value, '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const amount = parseAmount(data.get('amount'));
    const categoryId = data.get('categoryId');
    const date = data.get('date');

    showError(form, 'date', !date ? 'Pick the day this happened.' : date > todayISO() ? 'This date is in the future. Pick today or earlier.' : '');
    showError(form, 'categoryId', categoryId ? '' : 'Pick a category.');
    showError(form, 'amount', amount ? '' : 'Type an amount above zero, for example 12.50');
    if (!amount || !categoryId || !date || date > todayISO()) return;

    closeSheet();
    try {
      await saveTransaction({ ...t, amount, categoryId, date, kind: data.get('kind'), note: String(data.get('note')).trim() });
      toast(existing ? 'Changes saved' : 'Added');
    } catch { saveFailed(); }
  });

  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    closeSheet();
    try {
      await removeTransaction(t.id);
      toast('Transaction deleted', { label: 'Undo', run: () => saveTransaction(t).catch(saveFailed) });
    } catch { saveFailed(); }
  });
}

// ---------- Category ----------

export function openCategorySheet(id) {
  const existing = id ? categoryById(id) : null;
  const c = existing || { id: newId(), name: '', kind: 'expense', color: 'butter', icon: 'ellipsis', budget: 0, sort: state.categories.length };
  const used = state.transactions.filter((t) => t.categoryId === c.id).length + state.subscriptions.filter((s) => s.categoryId === c.id).length;

  const el = openSheet(`
    <form class="form" novalidate>
      ${head(existing ? 'Edit category' : 'New category')}

      <div class="field">
        <label for="c-name">Name</label>
        <input id="c-name" name="name" class="input" maxlength="30" autocomplete="off" value="${esc(c.name)}" ${existing ? '' : 'autofocus'}>
        <p class="error" data-error="name" hidden></p>
      </div>

      ${existing ? `<input type="hidden" name="kind" value="${c.kind}">` : `
      <fieldset class="segmented">
        <legend class="visually-hidden">Used for</legend>
        <label><input type="radio" name="kind" value="expense" checked><span>Expenses</span></label>
        <label><input type="radio" name="kind" value="income"><span>Income</span></label>
      </fieldset>`}

      <div class="field" data-budget ${c.kind === 'income' ? 'hidden' : ''}>
        <label for="c-budget">Monthly limit in euros <span class="optional">optional</span></label>
        <input id="c-budget" name="budget" class="input" inputmode="decimal" autocomplete="off" placeholder="No limit" value="${amountInput(c.budget)}" aria-describedby="h-budget">
        <p class="help" id="h-budget">The most you want to spend on this each month. Leave empty for no limit.</p>
        <p class="error" data-error="budget" hidden></p>
      </div>

      <fieldset class="field">
        <legend>Colour</legend>
        <div class="swatches">
          ${TONES.map((tone) => `<label class="swatch tone-${tone}"><input type="radio" name="color" value="${tone}" ${tone === c.color ? 'checked' : ''}><span class="visually-hidden">${tone}</span></label>`).join('')}
        </div>
      </fieldset>

      <fieldset class="field">
        <legend>Icon</legend>
        <div class="icons">
          ${ICONS.map((name) => `<label class="icon-choice"><input type="radio" name="icon" value="${name}" ${name === c.icon ? 'checked' : ''}><span>${icon(name, 20)}<span class="visually-hidden">${name.replace(/-/g, ' ')}</span></span></label>`).join('')}
        </div>
      </fieldset>

      ${existing && used ? `<p class="help">${used} ${used === 1 ? 'transaction or subscription uses' : 'transactions or subscriptions use'} this category, so it cannot be deleted. Move them to another category first.</p>` : ''}

      <div class="sheet-actions">
        ${existing && !used ? `<button type="button" class="btn btn-quiet btn-danger" data-delete>${icon('trash-2', 16)} Delete</button>` : '<span></span>'}
        <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Add category'}</button>
      </div>
    </form>`);

  const form = el.querySelector('form');

  form.addEventListener('change', (e) => {
    if (e.target.name === 'kind') form.querySelector('[data-budget]').hidden = e.target.value === 'income';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    const kind = data.get('kind');
    const budgetText = String(data.get('budget') || '').trim();
    const budget = kind === 'income' || !budgetText ? 0 : parseAmount(budgetText);

    showError(form, 'budget', budget === null ? 'Type a number, for example 300' : '');
    showError(form, 'name', name ? '' : 'Give the category a name.');
    if (!name || budget === null) return;

    closeSheet();
    try {
      await saveCategory({ ...c, name, kind, budget, color: data.get('color'), icon: data.get('icon') });
      toast(existing ? 'Changes saved' : 'Category added');
    } catch { saveFailed(); }
  });

  form.querySelector('[data-delete]')?.addEventListener('click', async () => {
    closeSheet();
    try {
      await removeCategory(c.id);
      toast('Category deleted', { label: 'Undo', run: () => saveCategory(c).catch(saveFailed) });
    } catch { saveFailed(); }
  });
}
