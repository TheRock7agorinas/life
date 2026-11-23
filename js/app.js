import { state, init, subscribe, signIn, signOut } from './store.js?v=202611231346';
import { icon } from './icons.js?v=202611231346';
import { closeSheet, toast, todayISO } from './ui.js?v=202611231346';
import * as home from './views/home.js?v=202611231346';
import * as budget from './views/budget.js?v=202611231346';
import * as settings from './views/settings.js?v=202611231346';
import { openTransactionSheet, openCategorySheet } from './views/sheets.js?v=202611231346';
import { openVaultEntrySheet, openVaultSettingsSheet } from './views/vault.js?v=202611231346';
import * as subscriptions from './views/subscriptions.js?v=202611231346';

const routes = {
  home: { title: 'Home', view: home },
  budget: { title: 'Budget', view: budget },
  subscriptions: { title: 'Subscriptions', view: subscriptions },
  settings: { title: 'Settings', view: settings },
};

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const sheet = document.getElementById('sheet');

// "#/budget/some-id" -> { name: 'budget', param: 'some-id' }
const currentRoute = () => {
  const [name, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return routes[name] ? { name, param: rest.join('/') } : { name: 'home', param: '' };
};

function renderNav(route) {
  const link = (name, ico, label) => `
    <a class="nav-item" href="#/${name}" ${route === name ? 'aria-current="page"' : ''}>
      ${icon(ico, 22)}<span>${label}</span>
    </a>`;
  nav.innerHTML = `
    <a class="brand" href="#/home"><img src="icon.svg" alt="" width="28" height="28"> Life</a>
    ${link('home', 'layout-grid', 'Home')}
    ${link('budget', 'wallet', 'Budget')}
    <button type="button" class="nav-add" data-action="add-txn" aria-label="Add transaction">${icon('plus', 24)}<span>Add transaction</span></button>
    ${link('subscriptions', 'receipt', 'Subscriptions')}
    ${link('settings', 'settings', 'Settings')}`;
}

function render() {
  if (!state.ready) {
    view.innerHTML = '<p class="loading">Loading your data…</p>';
    return;
  }
  const signedOut = state.mode === 'cloud' && !state.user;
  document.body.classList.toggle('is-signed-out', signedOut);
  if (signedOut) {
    nav.innerHTML = '';
    document.title = 'Sign in · Life';
    view.innerHTML = settings.renderSignIn();
    return;
  }
  const { name, param } = currentRoute();
  const route = routes[name];
  renderNav(route.nav || name);
  view.innerHTML = route.view.render(param);
  if (route.view.mount) route.view.mount(view, param);
  document.title = `${route.view.title ? route.view.title(param) : route.title} · Life`;
}

const actions = {
  'add-txn': () => openTransactionSheet(),
  'edit-txn': (el) => openTransactionSheet(el.dataset.id),
  'add-cat': () => openCategorySheet(),
  'edit-cat': (el) => openCategorySheet(el.dataset.id),
  'vault-add': () => openVaultEntrySheet(null, 'in'),
  'vault-take': () => openVaultEntrySheet(null, 'out'),
  'vault-edit': (el) => openVaultEntrySheet(el.dataset.id),
  'vault-settings': () => openVaultSettingsSheet(),
  'go-month': (el) => { budget.setMonth(el.dataset.month); render(); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); },
  'month-prev': () => { budget.shift(-1); render(); },
  'month-next': () => { budget.shift(1); render(); },
  'sub-add': () => subscriptions.openSubscriptionSheet(),
  'sub-edit': (el) => subscriptions.openSubscriptionSheet(el.dataset.id),
  'sub-log': (el) => subscriptions.logPayment(el.dataset.id),
  'sub-skip': (el) => subscriptions.skipPayment(el.dataset.id),
  'sign-out': () => signOut(),
  export: () => {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), categories: state.categories, transactions: state.transactions, vault: state.vault, vaultEntries: state.vaultEntries, subscriptions: state.subscriptions }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `life-backup-${todayISO()}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup downloaded');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
});

// Sheet: close with the X button or by clicking outside it.
sheet.addEventListener('click', (e) => {
  if (e.target === sheet || e.target.closest('[data-close]')) closeSheet();
});

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'signin') return;
  e.preventDefault();
  const form = e.target;
  const error = form.querySelector('[data-error="signin"]');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  error.hidden = true;
  try {
    await signIn(form.elements.email.value.trim(), form.elements.password.value);
  } catch {
    error.textContent = 'That email and password did not match. Check them and try again.';
    error.hidden = false;
    button.disabled = false;
  }
});

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); view.focus({ preventScroll: true }); });
subscribe(render);

render();
init().catch(() => {
  view.innerHTML = '<div class="panel"><h2>Your data could not be loaded</h2><p class="help">Check your internet connection, then reload the page.</p><button type="button" class="btn btn-primary" onclick="location.reload()">Reload</button></div>';
});
