import { state } from '../store.js?v=202611231403';
import { icon } from '../icons.js?v=202611231403';
import { esc } from '../ui.js?v=202611231403';

export function render() {
  const cloud = state.mode === 'cloud';
  return `
    <header class="page-head"><h1>Settings</h1></header>

    <section class="panel" aria-labelledby="h-data">
      <h2 id="h-data">Where your data lives</h2>
      ${cloud ? `
        <p class="status">${icon('cloud', 20)} <span>Saved in your private database, signed in as <strong>${esc(state.user.email)}</strong>.</span></p>
        <p class="help">Anything you add here shows up on your other devices after you sign in there.</p>
        <button type="button" class="btn btn-quiet" data-action="sign-out">${icon('log-out', 16)} Sign out</button>` : `
        <p class="status">${icon('cloud-off', 20)} <span>Saved on this device only, in this browser.</span></p>
        <p class="help">Your phone and your other computers will not see it until the database is connected. Clearing this browser's data would erase it, so download a backup now and then.</p>`}
    </section>

    <section class="panel" aria-labelledby="h-backup">
      <h2 id="h-backup">Backup</h2>
      <p class="help">Downloads all categories and transactions as one file you can keep somewhere safe.</p>
      <button type="button" class="btn btn-quiet" data-action="export">Download backup</button>
    </section>`;
}

export function renderSignIn() {
  return `
    <div class="signin">
      <header class="page-head">
        <p class="eyebrow">Life</p>
        <h1>Sign in</h1>
      </header>
      <form class="form panel" id="signin" novalidate>
        <div class="field">
          <label for="s-email">Email</label>
          <input id="s-email" name="email" type="email" class="input" autocomplete="username" required autofocus>
        </div>
        <div class="field">
          <label for="s-password">Password</label>
          <input id="s-password" name="password" type="password" class="input" autocomplete="current-password" required>
        </div>
        <p class="error" data-error="signin" hidden></p>
        <button type="submit" class="btn btn-primary">${icon('lock', 16)} Sign in</button>
      </form>
    </div>`;
}
