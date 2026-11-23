# Life: build guide for a Claude agent

This guide is for a Claude agent setting up its own person's copy of **Life**, a personal app that keeps budget, savings, subscriptions, recipes and a meal plan in one place. The code in this repo is complete and working; your job is to give your person their own copy with their own private database, their own hosting and their own content.

Read the whole guide before starting. Steps marked **(person)** need the person themself: creating accounts, choosing passwords and signing in. Never type a password for them and never ask them to paste one to you.


## 1. What the app does

- **Home**: a bento grid of pastel cards with this month's spending, today and this week, latest transactions, top category, income, the savings vault, and tiles for each part of life.
- **Budget**
  - Month totals: "Left after spending and saving" (income minus spending minus money put into the vault), spent, income. If category limits are set, the first tile becomes "Left to spend".
  - Vault: savings total, "Add money" and "Take out", a monthly saving goal suggested from the salary (10, 15 or 20%, with 20% from the 50/30/20 rule of thumb), and an in-app reminder until the goal is met.
  - Spending by day chart (with "View as table"), category cards with optional monthly limits, the transaction list, and a Monthly history (chart plus table of income, spent, saved and left per month).
  - Subscriptions page: name, price, monthly or yearly, payment day, category. When a payment date passes it shows as Due with **Log** (adds the expense on its date) and **Skip**, both with Undo. An expense that month whose note contains the subscription's name counts as already paid. Known services show their logo.
  - Totals are per calendar month, so they start from zero on the 1st; the vault total carries over.
- **Recipes**: recipe list with search and category filters, recipe pages with a servings stepper that rescales ingredients, macros per serving and Ninja Speedi settings, and a weekly meal plan with daily macro totals and a tickable shopping list.
- **Settings**: where the data lives, sign out, and a JSON backup download.


## 2. How it is built

- **No build step.** Plain HTML, CSS and JavaScript modules. It runs from any static host.
- **Data**: Supabase (Postgres with row level security) when `js/config.js` has a project URL and key; otherwise it falls back to the browser's local storage on that one device.
- **Hosting**: GitHub Pages.

```
index.html               app shell (nav, main view, sheet dialog, toast)
css/styles.css           all styles: design tokens, bento tiles, sheets, charts
js/app.js                router (#/home, #/budget, #/subscriptions, #/recipes, #/plan, #/settings) and click actions
js/store.js              all data and calculations; screens read `state` and call its functions
js/adapters/supabase.js  database reads and writes
js/adapters/local.js     same interface, saved in the browser only
js/config.js             Supabase URL and publishable key, recipe data location
js/views/*.js            one file per screen (home, budget, vault, subscriptions, sheets, recipes, settings)
js/icons.js              UI icons, generated from Lucide (ISC licence)
js/brands.js             service logos, generated from Simple Icons (CC0)
data/recipes.json        recipes and categories
data/plans.json          meal plan: daily targets, foods table, weeks with a shopping list
images/                  recipe photos stored with the app
supabase/schema.sql      every database table and security rule, run once
serve.js                 local preview server: node serve.js  ->  http://localhost:4174
tools/bump-version.js    run before publishing any change (see section 5)
```

**Database tables** (all in `supabase/schema.sql`): `budget_categories`, `budget_transactions`, `vault_settings`, `vault_entries`, `subscriptions`. Every row has a `user_id` that defaults to the signed-in user, and a row level security policy so each user can only see and change their own rows. Amounts are stored as whole cents.

**Design system**: cream background, pastel tiles (butter, pink, sage, sky, lavender, peach) with dark text in both light and dark mode, black pill buttons, a dark bottom bar on phones with a pink plus button, and a sidebar on desktop. Fonts: Instrument Serif for headings, Plus Jakarta Sans for text. Built to Apple's Human Interface Guidelines translated to the web: visible labels and inline errors on every field, Undo instead of confirmation dialogs for reversible actions, every chart with a title, period, one-sentence takeaway and a table view, targets of 44 px on touch, and colour never the only signal.


## 3. Set up a copy for your person

### 3.1 Copy the code

1. Check the person has a GitHub account and that `gh` is signed in to it (`gh auth status`).
2. Clone this repo into a new folder, remove its git history and start a fresh repo:
   ```
   git clone https://github.com/Katri-Buyte/life.git life
   cd life
   rm -rf .git
   git init -b main
   ```

### 3.2 Replace the personal content

The recipes and meal plan in this repo belong to the person who built it. Ask your person what they want before changing anything:

- **Meal plan** (`data/plans.json`): this holds the original owner's calorie and macro targets and their weekly plan. Replace it with your person's own plan, or with this empty file:
  ```json
  { "targets": { "calories": 2000, "protein": 120, "carbs": 220, "fat": 70 }, "note": "", "foods": {}, "weeks": [] }
  ```
- **Recipes** (`data/recipes.json`, `images/`): keep them if your person wants them, or replace with their own. Each recipe needs an `id`, `title`, `category` (one of the `categories` ids), `servings`, `ingredients` (`qty`, `unit`, `item`) and `steps`; macros are per serving. Use metric units.
- **Database settings** (`js/config.js`): set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to empty strings for now. Never leave the original owner's project in a copy for someone else.

### 3.3 Create the database (Supabase)

1. **(person)** Create a free Supabase account at supabase.com (signing in with GitHub is quickest), then a project: name `Life`, region closest to them, "Generate a password" for the database password and keep it in their password manager. The app never needs that password. Leave the three "Data access" options on.
2. Open the project's **SQL editor**, paste the whole of `supabase/schema.sql` and run it once. Supabase warns that the query "includes destructive operations"; that comes from the `drop policy if exists` lines, which only replace this app's own security rules, so it is safe on a new project. The result should read "Success. No rows returned".
3. In **Project Settings > API Keys**, copy the **Project URL** (`https://<ref>.supabase.co`) and the **publishable key** (`sb_publishable_...`) into `js/config.js`. The publishable key is meant to be public; the row level security rules are what keep the data private. Never use or commit a secret key (`sb_secret_...`).
4. **(person)** In **Authentication > Users**, "Add user", "Create new user", with their email and a password they choose, "Auto Confirm User" ticked. This is the login for the app.
5. In **Authentication > Sign In / Providers**, switch off **Allow new users to sign up** and save, so nobody else can create an account on their project. Reload the page to confirm it stayed off.
6. Check that the API refuses requests without a login: a `GET https://<ref>.supabase.co/rest/v1/budget_categories` with only the `apikey` header must return 401.

### 3.4 Test it locally

1. Run `node serve.js` and open http://localhost:4174. It should show the sign-in screen.
2. **(person)** Signs in.
3. The app creates the default categories on first load. Add one clearly named test transaction, reload, check it came back from the database, then delete **only that one** by its id or its test note.

### 3.5 Publish it

1. Explain to the person what a public repo means: the code, recipes and meal plan become public; the budget, vault and subscriptions do not, because they live in the database behind the login. If they want everything private, use a private repo and a host that serves private repos (Cloudflare Pages or Netlify) instead of the steps below.
2. Run `node tools/bump-version.js`, commit, then create the repo and turn on Pages:
   ```
   gh repo create <their-user>/life --public --source=. --remote=origin --push
   gh api -X POST repos/<their-user>/life/pages -f "source[branch]=main" -f "source[path]=/"
   ```
3. Wait for the build (`gh api repos/<their-user>/life/pages/builds/latest --jq .status` says `built`), then confirm the live site at `https://<their-user>.github.io/life/` shows the sign-in screen with no console errors.
4. **(person)** On their phone: open the address, sign in, and use the browser's "Add to Home screen" so it opens like an app.


## 4. How the app was built (the process)

The original was built in one long session, one module at a time, each tested in the browser before the next:

1. **Shell and budget** first, because it would be used daily: bento home, budget with categories, add and edit sheets, saved in the browser only.
2. **Vault** for savings, with a goal suggested from the salary and an in-app reminder.
3. **Recipes** moved in from a separate recipe book site and restyled to the bento look; that old site was later taken offline and its repo kept for reference.
4. **Database**: Supabase project, schema, login, sign-ups switched off. Then **hosting** on GitHub Pages.
5. **Month total counts savings**: the owner pointed out that money put in the vault was not subtracted; the first tile became "Left after spending and saving".
6. **Monthly history**, then **cache fix**: an update looked missing on the live site because browsers kept old copies of some files. Every file now carries one version number.
7. **Subscriptions**, then **service logos**.

Planned but not built yet: phone notifications for the saving reminder (needs a service worker and a scheduled job), workouts, wishlist, schedule, and a world scratch map.


## 5. Rules for making changes

- **Before publishing any change**, run `node tools/bump-version.js`. It stamps one `?v=` number on every import, script and stylesheet. Without it, browsers mix cached old files with new ones (GitHub Pages lets them cache for 10 minutes) and new features can be missing or broken.
- **After pushing**, do not say it is live until you have checked: GitHub Pages can keep serving the old `index.html` for a minute or more after the build says `built`. Poll `curl "https://<their-user>.github.io/life/?x=<random>"` until it shows the new `?v=` number, then load the page.
- **Never clear storage or delete data during tests without looking first.** The person may already be using the preview for real. Delete only the items you created, by id or a clear test name. The original owner lost a month of transactions this way.
- **When changing where data is saved** (local storage to the database, one table to another), move the existing data across first or ask the person.
- **New tables** go at the end of `supabase/schema.sql` with row level security, a policy limiting rows to `auth.uid()`, a grant to `authenticated` and a revoke from `anon`. Run only the new part in the SQL editor, and add matching functions to both adapters and to `store.js`.
- **Keep the design system.** New modules use the same tiles, tones, sheets and writing style. Plain, specific wording; say what happened and what to do next.
- **Free Supabase projects pause after about a week without use.** A paused project can be restored from the Supabase dashboard; nothing is lost.
- **Icons**: regenerate `js/icons.js` from `lucide-static` and `js/brands.js` from the `simple-icons` npm package. Do not draw brand logos by hand; services not in Simple Icons get a first-letter badge.
