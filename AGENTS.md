# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **PreMiD Activities** monorepo: a large collection of Discord Rich Presence
"Activities" (one per website under `websites/<Letter>/<Service>/`, each with a
`metadata.json` + `presence.ts`, optionally `iframe.ts`). The "application" is the `pmd`
CLI in `cli/`, which type-checks, compiles, validates, and live-reloads activities.
See `README.md` and `.github/CONTRIBUTING.md` for the developer workflow, and `cli/README.md`
for build internals.

### Setup / dependency notes
- Node `>=20` is required (see `engines` in `package.json`). The startup update script runs
  `npm install`, whose root `prepare` script builds the CLI (`cd cli && npm ci && npm run build`)
  into `cli/dist`, then installs root deps with `--ignore-scripts`. So a plain `npm install`
  fully bootstraps both the CLI and the workspace.
- The `pmd` binary runs from the compiled `cli/dist`, **not** from `cli/src`. After editing CLI
  source under `cli/src/`, rebuild before the change takes effect: `cd cli && npm run build`
  (or `npm run build:watch`). Just re-running `pmd` will otherwise use stale code.

### Commands (services / tasks)
- Lint: `npm run lint` (eslint). NOTE: this lints the whole repo (thousands of activities) and
  is slow. When iterating, scope eslint to specific paths, e.g. `npx eslint cli/src` or
  `npx eslint websites/Y/YouTube/presence.ts`.
- CLI unit tests: `cd cli && npm test` (vitest, ~34 tests).
- Build one activity: `npx pmd build <Service>` (type-checks + compiles to
  `websites/<L>/<Service>/dist`, which is gitignored). Use `--no-kill` to keep going on errors,
  `--all` for everything, `--changed` for changed activities only.
- Dev / live-reload: `npx pmd dev <Service>` (README's primary dev command). This is a
  long-running watcher that also starts a WebSocket server on **port 3021** to push the compiled
  activity to the PreMiD browser extension. With no extension present, you can simulate one by
  connecting a WebSocket client to `ws://localhost:3021`; the server sends a `localPresence`
  message containing the compiled `presence.js` / `metadata.json` and expects a `received` reply.

### Gotchas
- `pmd build --validate`, `pmd check-dns`, and asset/DNS validation make live network requests
  (image dimension checks against image hosts, DNS lookups). These can fail in offline/sandboxed
  environments even when the activity code is correct; plain `pmd build <Service>` (type-check +
  compile) does not need the network.
- Commits are enforced by commitlint (see `.github/COMMIT_CONVENTION.md` / `commitlint.config.js`).
