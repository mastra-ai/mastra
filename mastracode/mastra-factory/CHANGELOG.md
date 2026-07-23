# create-factory

## 0.1.0

### Minor Changes

- Standardized the Factory SPA directory and simplified the generated build script because `mastra build` now packages the prebuilt UI automatically. ([#19948](https://github.com/mastra-ai/mastra/pull/19948))

  Before:

  ```json
  { "build": "npm run build:ui && mastra build --dir src/mastra" }
  ```

  After:

  ```json
  { "build": "mastra build --dir src/mastra" }
  ```

  Factory assets now land in `src/mastra/public/factory/` during the build and `.mastra/output/factory/` in the deployable output, replacing the previous `ui/` path.

- Added EU and US region selection when creating Factory platform projects, with a --region flag for non-interactive setup. ([#20040](https://github.com/mastra-ai/mastra/pull/20040))

### Patch Changes

- Updated the generated project README for the single-server setup: the Factory UI and API are both served from `http://localhost:4111`, OAuth callback instructions use the server origin, and the removed `dev:prod` / `build:ui` scripts are no longer documented. ([#20036](https://github.com/mastra-ai/mastra/pull/20036))

- Apply prettier formatting to env.test.ts (post-merge follow-up) ([#19965](https://github.com/mastra-ai/mastra/pull/19965))

- Harden .env handling in create-factory: tighten file permissions and skip git init when .env cannot be gitignored ([#19945](https://github.com/mastra-ai/mastra/pull/19945))

  `.env` files created during scaffolding are now written with `0600` permissions so platform secrets (`MASTRA_PLATFORM_SECRET_KEY`, `DATABASE_URL`) are only readable by the owner. If the scaffolder can't add `.env` to `.gitignore` (e.g. permission denied on `.gitignore`), it now skips `git init` entirely and warns the user, so freshly-minted secrets can't accidentally be committed to the initial commit.

- Make the Software Factory template installable and buildable against published packages so the sync-softwarefactory-template workflow can push it again. Three changes to the generation step: ([#20001](https://github.com/mastra-ai/mastra/pull/20001))

  - Pin every synced Mastra dep to `"alpha"` instead of `"latest"` — the Mastra Factory sources on `main` are built against the alpha release train, and the previous `"latest"` default mixed release trains (worse, `@mastra/factory@latest` is currently an empty stub).
  - Emit `.npmrc` with `legacy-peer-deps=true` so npm accepts the internally-consistent prerelease peer graph (the same relaxation pnpm applies automatically inside the monorepo).
  - Downgrade `typescript` from tsgo (v7) to the classic compiler (`^5.9.2`) in the emitted template. The sources happily typecheck under tsgo, but `mastra build` transitively loads TypeScript via `typescript-paths`, which needs the classic `ts.sys` API tsgo doesn't expose. In the monorepo pnpm hoists classic TypeScript from another workspace package, hiding the problem; the standalone template has no hoist.

  All three are annotated as temporary in the script and README — remove once the packages ship stable releases and the deployer supports tsgo.

- Marked projects created by create-factory as factory-enabled on the Mastra platform. ([#19973](https://github.com/mastra-ai/mastra/pull/19973))

- Changed the create-factory template sync to pin every Mastra dep to `"latest"` instead of `"alpha"`. Scaffolded projects now install the same set of Mastra packages as every other create-mastra template, and no longer ship a `.npmrc` with `legacy-peer-deps=true` (that flag only existed to accommodate the prerelease peer graph). ([#20052](https://github.com/mastra-ai/mastra/pull/20052))

- The factory template now ships a pnpm-workspace.yaml with allowBuilds, preventing pnpm v10+ from exiting with ERR_PNPM_IGNORED_BUILDS during install or build. The file mirrors the mastracode/web build-approval policy minus test-only deps stripped by the template. ([#20056](https://github.com/mastra-ai/mastra/pull/20056))

- Improved the create-factory sign-in and success experience: ([#20024](https://github.com/mastra-ai/mastra/pull/20024))

  - When no Mastra platform session exists, the CLI now pauses with "Mastra account is required, press enter to continue..." before opening the browser auth flow instead of opening it unannounced.
  - The success message now summarizes the infrastructure provisioned on Mastra platform (project, Postgres database, credentials in .env), notes that deployed code agent sessions run inside Mastra platform sandboxes, and links to https://projects.mastra.ai for managing the project.

- Stopped writing MASTRA_SHARED_API_URL to the scaffolded project's .env during platform provisioning. Platform consumers now use their built-in default platform URL, so scaffolded factories no longer pin the API endpoint at create time. ([#20021](https://github.com/mastra-ai/mastra/pull/20021))

- Added the `create-factory` CLI. It scaffolds a Mastra Software Factory project: enter a project name and the CLI clones the template, installs dependencies, and initializes git. Configuration (model providers, integrations, database) happens in the web UI on first load. ([#19609](https://github.com/mastra-ai/mastra/pull/19609))

  ```bash
  npm create factory my-factory
  cd my-factory
  npm run dev
  ```

- Fixed generated Factory projects to serve the UI and API from a single Mastra development server. ([#20019](https://github.com/mastra-ai/mastra/pull/20019))

- Stop shipping `pnpm-workspace.yaml` and `package-lock.json` in projects scaffolded by `npm create factory`. The template generator now excludes the web project's pnpm workspace marker and lockfiles, and the sync workflow validates the template in a throwaway copy so `npm install` artifacts can no longer leak into the published template repository. ([#20041](https://github.com/mastra-ai/mastra/pull/20041))

- Simplified the create-factory success message: sandboxes now appear as a bullet in the provisioned resources list so users know code agent sessions run inside Mastra platform sandboxes. ([#20062](https://github.com/mastra-ai/mastra/pull/20062))

- Fixed generated Software Factory projects missing their required `@mastra/memory` dependency. ([#19878](https://github.com/mastra-ai/mastra/pull/19878))

- Added platform sign-in, project creation, and Neon Postgres provisioning to the `create factory` CLI. After scaffolding, the CLI: ([#19945](https://github.com/mastra-ai/mastra/pull/19945))

  - Signs the user in via the existing Mastra browser-auth flow.
  - Creates a Mastra platform server project in the chosen organization.
  - Mints an `sk_` organization API key scoped to the new factory.
  - Attaches and provisions a Neon Postgres database.
  - Writes `MASTRA_SHARED_API_URL`, `MASTRA_ORGANIZATION_ID`, `MASTRA_PROJECT_ID`, `MASTRA_PLATFORM_SECRET_KEY`, and `DATABASE_URL` to the project's `.env`.

  The result is a locally-runnable factory that can talk to the Mastra platform on first `npm run dev` without any manual configuration.

  **New flags:**

  - `--no-platform` — skip the platform round-trip; useful when iterating on the template offline.
  - `--region <region>` — pass a specific Neon region id through to the platform.

- Updated dependencies [[`c03d857`](https://github.com/mastra-ai/mastra/commit/c03d85791d04177bdc6095cef924aec47a440b70), [`91930d6`](https://github.com/mastra-ai/mastra/commit/91930d69ae8146ded10c792387848970f1ca4b59), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`8c88764`](https://github.com/mastra-ai/mastra/commit/8c88764162b32c8a24b3bf9d1ad2ec535aba5c9a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`bfa8c05`](https://github.com/mastra-ai/mastra/commit/bfa8c056fc235f17805f1eb93e738ee81e8a8cb6), [`0182be3`](https://github.com/mastra-ai/mastra/commit/0182be35cd402209182097098e7ebc07a5a54a2a), [`c9de100`](https://github.com/mastra-ai/mastra/commit/c9de10008ff3f72911bf746294004c305674d855), [`0a50de7`](https://github.com/mastra-ai/mastra/commit/0a50de7024816171701e81ac3b69434cf5a302ea), [`f2e0c72`](https://github.com/mastra-ai/mastra/commit/f2e0c72fa27555bc59c0322b6398e7a6d990d679), [`471e34c`](https://github.com/mastra-ai/mastra/commit/471e34c399410c380d07c03abf7d3bbf2de736e0), [`7eb2707`](https://github.com/mastra-ai/mastra/commit/7eb2707cc388f929a38562fecb075064aed71d44), [`471e34c`](https://github.com/mastra-ai/mastra/commit/471e34c399410c380d07c03abf7d3bbf2de736e0), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`40ae860`](https://github.com/mastra-ai/mastra/commit/40ae860a674e7ee383a02c1f990d1e050619d5e4), [`471e34c`](https://github.com/mastra-ai/mastra/commit/471e34c399410c380d07c03abf7d3bbf2de736e0), [`f2e0c72`](https://github.com/mastra-ai/mastra/commit/f2e0c72fa27555bc59c0322b6398e7a6d990d679), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`471e34c`](https://github.com/mastra-ai/mastra/commit/471e34c399410c380d07c03abf7d3bbf2de736e0), [`471e34c`](https://github.com/mastra-ai/mastra/commit/471e34c399410c380d07c03abf7d3bbf2de736e0), [`51f62f0`](https://github.com/mastra-ai/mastra/commit/51f62f0f8ae3906a4b46ceb987f19c8245563cfa), [`20b159d`](https://github.com/mastra-ai/mastra/commit/20b159d8f5d8153493ec8d5b6cd2864af8ce2c8e)]:
  - mastra@1.20.0

## 0.1.0-alpha.12

### Patch Changes

- Updated dependencies [[`bfa8c05`](https://github.com/mastra-ai/mastra/commit/bfa8c056fc235f17805f1eb93e738ee81e8a8cb6)]:
  - mastra@1.20.0-alpha.18

## 0.1.0-alpha.11

### Patch Changes

- Updated dependencies [[`c9de100`](https://github.com/mastra-ai/mastra/commit/c9de10008ff3f72911bf746294004c305674d855), [`20b159d`](https://github.com/mastra-ai/mastra/commit/20b159d8f5d8153493ec8d5b6cd2864af8ce2c8e)]:
  - mastra@1.20.0-alpha.17

## 0.1.0-alpha.10

### Patch Changes

- Changed the create-factory template sync to pin every Mastra dep to `"latest"` instead of `"alpha"`. Scaffolded projects now install the same set of Mastra packages as every other create-mastra template, and no longer ship a `.npmrc` with `legacy-peer-deps=true` (that flag only existed to accommodate the prerelease peer graph). ([#20052](https://github.com/mastra-ai/mastra/pull/20052))

- Updated dependencies [[`91930d6`](https://github.com/mastra-ai/mastra/commit/91930d69ae8146ded10c792387848970f1ca4b59)]:
  - mastra@1.20.0-alpha.16

## 0.1.0-alpha.9

### Patch Changes

- Simplified the create-factory success message: sandboxes now appear as a bullet in the provisioned resources list so users know code agent sessions run inside Mastra platform sandboxes. ([#20062](https://github.com/mastra-ai/mastra/pull/20062))

## 0.1.0-alpha.8

### Patch Changes

- The factory template now ships a pnpm-workspace.yaml with allowBuilds, preventing pnpm v10+ from exiting with ERR_PNPM_IGNORED_BUILDS during install or build. The file mirrors the mastracode/web build-approval policy minus test-only deps stripped by the template. ([#20056](https://github.com/mastra-ai/mastra/pull/20056))

- Updated dependencies [[`0182be3`](https://github.com/mastra-ai/mastra/commit/0182be35cd402209182097098e7ebc07a5a54a2a)]:
  - mastra@1.20.0-alpha.15

## 0.1.0-alpha.7

### Minor Changes

- Added EU and US region selection when creating Factory platform projects, with a --region flag for non-interactive setup. ([#20040](https://github.com/mastra-ai/mastra/pull/20040))

### Patch Changes

- Updated the generated project README for the single-server setup: the Factory UI and API are both served from `http://localhost:4111`, OAuth callback instructions use the server origin, and the removed `dev:prod` / `build:ui` scripts are no longer documented. ([#20036](https://github.com/mastra-ai/mastra/pull/20036))

- Stop shipping `pnpm-workspace.yaml` and `package-lock.json` in projects scaffolded by `npm create factory`. The template generator now excludes the web project's pnpm workspace marker and lockfiles, and the sync workflow validates the template in a throwaway copy so `npm install` artifacts can no longer leak into the published template repository. ([#20041](https://github.com/mastra-ai/mastra/pull/20041))

## 0.1.0-alpha.6

### Patch Changes

- Improved the create-factory sign-in and success experience: ([#20024](https://github.com/mastra-ai/mastra/pull/20024))

  - When no Mastra platform session exists, the CLI now pauses with "Mastra account is required, press enter to continue..." before opening the browser auth flow instead of opening it unannounced.
  - The success message now summarizes the infrastructure provisioned on Mastra platform (project, Postgres database, credentials in .env), notes that deployed code agent sessions run inside Mastra platform sandboxes, and links to https://projects.mastra.ai for managing the project.

- Fixed generated Factory projects to serve the UI and API from a single Mastra development server. ([#20019](https://github.com/mastra-ai/mastra/pull/20019))

## 0.1.0-alpha.5

### Patch Changes

- Stopped writing MASTRA_SHARED_API_URL to the scaffolded project's .env during platform provisioning. Platform consumers now use their built-in default platform URL, so scaffolded factories no longer pin the API endpoint at create time. ([#20021](https://github.com/mastra-ai/mastra/pull/20021))

## 0.1.0-alpha.4

### Minor Changes

- Standardized the Vite SPA output directory to `src/mastra/public/factory/`. The template's `build` script delegates SPA building to `mastra build` (which calls `build:ui` automatically) instead of chaining it separately. ([#19948](https://github.com/mastra-ai/mastra/pull/19948))

### Patch Changes

- Make the Software Factory template installable and buildable against published packages so the sync-softwarefactory-template workflow can push it again. Three changes to the generation step: ([#20001](https://github.com/mastra-ai/mastra/pull/20001))

  - Pin every synced Mastra dep to `"alpha"` instead of `"latest"` — the Mastra Factory sources on `main` are built against the alpha release train, and the previous `"latest"` default mixed release trains (worse, `@mastra/factory@latest` is currently an empty stub).
  - Emit `.npmrc` with `legacy-peer-deps=true` so npm accepts the internally-consistent prerelease peer graph (the same relaxation pnpm applies automatically inside the monorepo).
  - Downgrade `typescript` from tsgo (v7) to the classic compiler (`^5.9.2`) in the emitted template. The sources happily typecheck under tsgo, but `mastra build` transitively loads TypeScript via `typescript-paths`, which needs the classic `ts.sys` API tsgo doesn't expose. In the monorepo pnpm hoists classic TypeScript from another workspace package, hiding the problem; the standalone template has no hoist.

  All three are annotated as temporary in the script and README — remove once the packages ship stable releases and the deployer supports tsgo.

- Updated dependencies [[`0a50de7`](https://github.com/mastra-ai/mastra/commit/0a50de7024816171701e81ac3b69434cf5a302ea)]:
  - mastra@1.20.0-alpha.14

## 0.0.3-alpha.3

### Patch Changes

- The Software Factory template now pins every Mastra dep to `"latest"` instead of a caret range anchored on the current monorepo version, matching how every other create-mastra template ships. `sync-template.mjs` no longer shells out to `npm view` and no longer needs the `--tag` flag or the `legacy-peer-deps=true` `.npmrc` (which only existed to work around prerelease pins). The sync workflow no longer breaks whenever a linked package sits mid-alpha between publishes. ([#19989](https://github.com/mastra-ai/mastra/pull/19989))

## 0.0.3-alpha.2

### Patch Changes

- Marked projects created by create-factory as factory-enabled on the Mastra platform. ([#19973](https://github.com/mastra-ai/mastra/pull/19973))

- Updated dependencies:
  - mastra@1.20.0-alpha.13

## 0.0.3-alpha.1

### Patch Changes

- Apply prettier formatting to env.test.ts (post-merge follow-up) ([#19965](https://github.com/mastra-ai/mastra/pull/19965))

- Harden .env handling in create-factory: tighten file permissions and skip git init when .env cannot be gitignored ([#19945](https://github.com/mastra-ai/mastra/pull/19945))

  `.env` files created during scaffolding are now written with `0600` permissions so platform secrets (`MASTRA_PLATFORM_SECRET_KEY`, `DATABASE_URL`) are only readable by the owner. If the scaffolder can't add `.env` to `.gitignore` (e.g. permission denied on `.gitignore`), it now skips `git init` entirely and warns the user, so freshly-minted secrets can't accidentally be committed to the initial commit.

- Fixed generated Software Factory projects missing their required `@mastra/memory` dependency. ([#19878](https://github.com/mastra-ai/mastra/pull/19878))

- Added platform sign-in, project creation, and Neon Postgres provisioning to the `create factory` CLI. After scaffolding, the CLI: ([#19945](https://github.com/mastra-ai/mastra/pull/19945))

  - Signs the user in via the existing Mastra browser-auth flow.
  - Creates a Mastra platform server project in the chosen organization.
  - Mints an `sk_` organization API key scoped to the new factory.
  - Attaches and provisions a Neon Postgres database.
  - Writes `MASTRA_SHARED_API_URL`, `MASTRA_ORGANIZATION_ID`, `MASTRA_PROJECT_ID`, `MASTRA_PLATFORM_SECRET_KEY`, and `DATABASE_URL` to the project's `.env`.

  The result is a locally-runnable factory that can talk to the Mastra platform on first `npm run dev` without any manual configuration.

  **New flags:**

  - `--no-platform` — skip the platform round-trip; useful when iterating on the template offline.
  - `--region <region>` — pass a specific Neon region id through to the platform.

- Updated dependencies [[`8c88764`](https://github.com/mastra-ai/mastra/commit/8c88764162b32c8a24b3bf9d1ad2ec535aba5c9a), [`40ae860`](https://github.com/mastra-ai/mastra/commit/40ae860a674e7ee383a02c1f990d1e050619d5e4)]:
  - mastra@1.20.0-alpha.12

## 0.0.3-alpha.0

### Patch Changes

- Added the `create-factory` CLI. It scaffolds a Mastra Software Factory project: enter a project name and the CLI clones the template, installs dependencies, and initializes git. Configuration (model providers, integrations, database) happens in the web UI on first load. ([#19609](https://github.com/mastra-ai/mastra/pull/19609))

  ```bash
  npm create factory my-factory
  cd my-factory
  npm run dev
  ```

## 0.0.2

### Patch Changes

- First real scaffold release for `npm create factory`. Clones the softwarefactory template, installs dependencies, initializes git, and prints next steps. Configuration (model providers, database, integrations) happens in the web UI on first load.

## 0.0.1

### Patch Changes

- Initial public package name claim.
