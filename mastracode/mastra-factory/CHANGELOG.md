# create-factory

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
