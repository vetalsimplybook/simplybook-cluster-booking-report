# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page, static (no build step, no backend) web tool that authenticates against a SimplyBook cluster, lets the user pick one or more companies, pulls detailed booking reports for each from the SimplyBook user API, and exports the merged result as one CSV. Everything runs client-side in the browser — there is no server component to this repo.

## Running it

There is no build/test/lint tooling. Just serve the three static files:

```bash
php -S localhost:8000        # or any static file server, from the repo root
```

Then open `index.html` (directly via `file://` also works, since all API calls go to external hosts).

If you edit `css/style.less`, recompile to CSS (the compiled `css/style.css` is what `index.html` actually loads):

```bash
lessc css/style.less css/style.css --source-map
```

## Architecture

Three files carry the whole app:

- `index.html` — Bootstrap 5 + jQuery shell with three `.step` divs (`step-1` auth form, `step-2` company selection, `step-3` injected at runtime for report progress/results). Steps are shown/hidden by toggling an `active` class, not routed.
- `js/script.js` — all application logic, as a single `ReportCreator` constructor with its prototype built via `jQuery.extend(ReportCreator.prototype, {...})`. One instance is created on `DOMContentLoaded`. No modules/bundler — it's plain ES5-ish jQuery.
- `css/style.less` (compiled to `css/style.css`) — custom styling on top of Bootstrap.

### Request flow (all in `js/script.js`)

1. **Cluster auth** (`authenticate` → `getClusterToken`): POSTs the user's API key to `https://cluster-api.{domain}/auth` to get a cluster token. Token + config are cached in `localStorage` under `simplybook_cluster_token` for 30 minutes (`saveClusterTokenToStorage`/`getClusterTokenFromStorage`); `checkCachedTokenAndAutoLogin` uses this to skip straight to step 2 on reload if the cache is still valid *and* still works.
2. **Company listing** (`getAllCompanies`): paginates `GET /companies` on the cluster API (50/page) using `response.metadata.pages_count` until exhausted, recursing via a local `loadPage()`.
3. **Per-company token exchange** (`getCompanyTokens` → `getCompanyToken`): for each selected company, `POST /companies/{login}/api-token` on the cluster API, using `Promise.allSettled` so one company's failure doesn't block the rest — failures are pushed into `this.reportData.errors` and surfaced per-company in the UI (`updateCompanyStatus`).
4. **Report generation per company** (`getCompanyBookings` + `pollReportStatus`): a two-step async job against `https://user-api-v2.{domain}/admin/detailed-report`:
   - `POST` with `{filter, order_field, order_direction}` creates the job and returns `{id}`.
   - `GET /admin/detailed-report/{id}` is polled every 5s (`pollInterval`) until it returns an array (or `{data: [...]}`) instead of the "still processing" `{code: 404}` shape. The poll timeout comes from the `#report_timeout` field (minutes, default 2) set in step 2, converted to `maxAttempts` in `getCompanyBookings` and passed into `pollReportStatus`.
   - `filter` keys currently wired to the UI: `status`, `date_from`/`date_to` (booking start range), `created_date_from`/`created_date_to` (creation range). Extending the filters means adding a form field in `index.html` and a corresponding key in `getCompanyBookings`.
   - A company that times out or fails can be re-run individually via the retry button rendered by `updateCompanyStatus` (`.retry-company-btn`, delegated in `bindEvents`) → `retryCompany`, which clears that company's prior error/data from `this.reportData` and redoes the token+bookings fetch without restarting the other companies.
5. **CSV export** (`generateCSV` → `downloadCSVReport`): flattens each booking (including nested objects, dot-joined with `_`; arrays joined with `; `; booleans as `Yes`/`No`) via `flattenObject`, unions all resulting keys as headers (a fixed `priorityFields` list first, remaining keys alphabetically after), and writes one row per booking across *all* companies into a single CSV blob. Headers are derived from the first booking only — if later companies/bookings have keys the first one lacked, those columns are silently dropped from the row (only fields present in the first flattened booking are ever selected). Keep this in mind if changing field ordering or if data looks like it's missing columns.

### Error handling pattern

Every `$.ajax` error callback funnels through `handleApiError(xhr, operationName)`, which clears the cached cluster token on 401/403 (forcing re-auth next time) and logs the operation name. Per-company failures during token/report collection do not abort the whole run — they're recorded in `this.reportData.errors` and shown in an error summary alongside whatever succeeded.

### Domain selection

`index.html` offers a dropdown of known SimplyBook domains (`simplybook.vip/.pro/.plus/.us/.cc`, `enterpriseappointments.com`) plus a "Custom domain..." option that reveals a free-text field. `handleDomainSelection` resolves the effective domain into the hidden `#domain_final` input; `getClusterApiUrl`/`getUserApiUrl` build API base URLs from `this.config.domain`.
