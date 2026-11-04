# Security Scanner

Map authorized websites and APIs, compare access across identities, and investigate potential vulnerabilities with bounded evidence. The local console can assess a REST API with two API-key users, record a grounded BOLA result, and show advisory triage. A project-owned Orders API provides both vulnerable and protected examples. Morph models are optional for ordinary setup and discovery, but required for the REST assessment's Sherlock, Dupin and Watson steps.

## Why we built this

A security inventory needs to show what each identity can access and which findings have reproducible evidence. The scanner keeps target authorization, request limits, approvals, and confirmation checks under application control.

## Prerequisites

- **[Docker Desktop](https://docs.docker.com/desktop/)**: a native Linux ARM64 daemon and the Docker CLI. Set `DOCKER_SOCKET` if your socket differs from `/var/run/docker.sock`. Setup downloads pinned runtime inputs and checks Chromium's sandbox. The example target runs in a locally built, project-owned container.
- Set `CONTROL_BOOTSTRAP_SECRET` to a random sign-in secret and `SCANNER_ENCRYPTION_KEY` to an independent 32-byte key in lowercase hex. See [configuration](docs/configuration.md) for the generation command. Keep the encryption key available across restarts.
- Discovery is opt-in: set `SCANNER_DISCOVERY_ENABLED=true` after setup. Assess only authorized targets. Non-lab targets also require an explicit evidence-retention policy.
- **[Morph API key](https://www.morphllm.com/dashboard/api-keys)**: required for the model-backed REST assessment and optional for ordinary discovery. Set `MORPH_API_KEY` and `SCANNER_INVESTIGATION_ENABLED=true` after confirming access to the configured `EXPLORER_MODEL` and `JUDGE_MODEL`. Model calls can incur charges. Setup and public discovery do not need this key.

## Quickstart 🚀

1. **Install the template**
   - From `templates/template-security-scanner` in your checkout, run `npm install --workspaces=false`.
2. **Configure the runtime**
   - Run `cp .env.example .env` on a new checkout and fill in the settings under Prerequisites.
3. **Prepare the runtime**
   - Run `npm run setup`, then set `SCANNER_DISCOVERY_ENABLED=true` in `.env` to enable discovery.
4. **Start the Orders API in terminal one**
   - Run `npm run example-target`. Keep its printed URLs, user IDs and API keys private. The default mode allows a cross-user read of an A-owned order.
5. **Open the console in terminal two**
   - Run `npm run dev` and open [the local console](http://127.0.0.1:4111/). Sign in with `CONTROL_BOOTSTRAP_SECRET`.
   - Create a GET/HEAD policy, then an authorized REST API target using the example's printed `scannerUrl` and `openApiUrl`. Confirm the order routes as owner-only and products as public. Add A and B as separate API-key profiles. Set `x-api-key` as the header, `/api/orders` as the access-check path and `/principal` as the account identifier JSON pointer for both, then check each identity after the last edit.
   - Choose **Start REST assessment** on the target. **Scans** shows the selected owner resource and comparison; **Findings** shows a separate REST BOLA record if the vulnerable read is confirmed. Follow the [exact console steps](docs/console-scan.md).

## Try it out

- Run `npm run doctor` to check runtime and storage readiness. Restart the Orders API with `npm run example-target -- --mode=protected` and repeat the REST assessment. The cross-user detail read is denied and the new assessment creates no finding; the seeded users and data remain available.
- With `npm run dev` still running, use `npm run sync:advisories` in another terminal to import cve.now advisories. This can contact the real feed and, when models are enabled, make paid calls. A failed or inconsistent feed cycle reports `SKIPPED`; a later manual or opt-in scheduled attempt can retry after the displayed backoff. Any pages already imported remain visible with stale and incomplete status, and skipped cycles do not plan hypotheses. **Vulnerabilities** shows manual hypotheses or pending triage, with target relevance distinct from advisory severity.
- Stop the listener and run `npm run lab` for the existing owned-lab scan. Open the printed console URL and run public discovery. Ctrl+C removes its temporary resources.
- Add a header, bearer, or cookie profile and compare its inventory with the public profile. Headless discovery also records browser XHR surfaces.
- Cancel a scan and inspect its partial inventory and cleanup status. Restart the server to see saved records, then search offline references. Investigation planning and verification follow the [configuration and execution boundaries](docs/configuration.md).

REST BOLA requires two independently observed account identities. Set the same `principalJsonPointer` and existing access-check path on both API-key drivers; for the Orders example, use `/principal` in `/api/orders`. The console's account identifier field is optional for discovery. Missing or equal account evidence yields `INCONCLUSIVE` without model or verifier requests. This mechanism adds only the finite identity comparison to retained data. Authorized inventory paths keep their existing retention and can contain identifiers.

## Customization

- Open the project in your coding agent: “Add an inventory view that groups endpoints by role. Explore the code and propose a plan before making changes.”
- Adjust target scopes, identities, finite budgets, and retention through the console or protected API. Contracts document their fields under `src/core/`, `src/discovery/`, and `src/investigation/`.
- Extend the supported [application](docs/contracts/application-drivers.md), [authentication](docs/contracts/authentication-drivers.md), [route access](docs/contracts/route-access.md), [vulnerability category](docs/contracts/vulnerability-categories.md) and [checker](docs/contracts/checkers.md) contracts. SPA, GraphQL, login/password and external script checkers remain unsupported until they have reviewed executors.

## Testing and maintenance

See [the example target](docs/example-target.md) for URLs, protected mode, OpenAPI and local transport; [testing](docs/testing.md) for local checks and Docker integration suites; [configuration](docs/configuration.md) for identities and optional services; and [operations](docs/operations.md) for drain, backup, restore and key loss. A temporary ngrok URL can exercise the public HTTPS scanner path against the same project-owned Hono example. It does not establish independently hosted staging coverage.

## About Mastra templates

This official Mastra template is being developed in the [Mastra monorepo](https://github.com/mastra-ai/mastra). The quickstart above applies to this checkout; it does not assume a published scaffold or Studio route.

[Want to contribute?](CONTRIBUTING.md)
