# Security Scanner

Map authorized websites and APIs, compare access across identities, and investigate potential vulnerabilities with bounded evidence. This Mastra template includes a local console, Katana/Chromium discovery, offline security playbooks, and optional Morph models for planning and evidence review.

## Why we built this

A security inventory needs to show what each identity can access and which findings have reproducible evidence. The scanner keeps target authorization, request limits, approvals, and confirmation checks under application control.

## Prerequisites

- **[Docker Desktop](https://docs.docker.com/desktop/)**: a native Linux ARM64 daemon and the Docker CLI. Set `DOCKER_SOCKET` if your socket differs from `/var/run/docker.sock`. Setup downloads pinned runtime inputs and checks Chromium's sandbox.
- Set `CONTROL_BOOTSTRAP_SECRET` to a random sign-in secret and `SCANNER_ENCRYPTION_KEY` to an independent 32-byte key in lowercase hex. See [configuration](docs/configuration.md) for the generation command. Keep the encryption key available across restarts.
- Discovery is opt-in: set `SCANNER_DISCOVERY_ENABLED=true` after setup. Assess only authorized targets. Non-lab targets also require an explicit evidence-retention policy.
- **[Morph API key](https://www.morphllm.com/dashboard/api-keys)**: optional. Set `MORPH_API_KEY` and `SCANNER_INVESTIGATION_ENABLED=true` for planning and review. This can incur charges. Setup and discovery do not need a model key.

## Quickstart 🚀

1. **Install the template**
   - From `templates/template-security-scanner` in your checkout, run `npm install --workspaces=false`.
2. **Configure the runtime**
   - Run `cp .env.example .env` on a new checkout and fill in the settings under Prerequisites.
3. **Prepare the runtime**
   - Run `npm run setup`, then set `SCANNER_DISCOVERY_ENABLED=true` in `.env` to enable discovery.
4. **Open the console**
   - Run `npm run dev` and open [the local console](http://127.0.0.1:4111/).
   - Sign in with `CONTROL_BOOTSTRAP_SECRET`. Create a policy and an authorized target, add a public profile, check its identity, and choose **New scan**. The Scans view shows its progress and retained inventory.

## Try it out

- Run `npm run doctor` to check runtime prerequisites and storage readiness.
- Stop the listener and run `npm run lab` for a project-owned Docker target. Open the printed console URL and run public discovery. Ctrl+C removes its temporary resources.
- Add a header, bearer, or cookie profile and compare its inventory with the public profile. Headless discovery also records browser XHR surfaces.
- Cancel a scan and inspect its partial inventory and cleanup status. Restart the server to see the saved records.
- Search offline references in the console. Optional advisory synchronization imports cve.now records; investigation planning and verification require the [configuration and execution boundaries](docs/configuration.md).

## Customization

- Open the project in your coding agent: “Add an inventory view that groups endpoints by role. Explore the code and propose a plan before making changes.”
- Adjust target scopes, identities, finite budgets, and retention through the console or protected API. Contracts document their fields under `src/core/`, `src/discovery/`, and `src/investigation/`.

## Testing and maintenance

See [testing](docs/testing.md) for local checks and the Docker integration suites, [configuration](docs/configuration.md) for identities and optional services, and [operations](docs/operations.md) for drain, backup, restore, and key loss.

## About Mastra templates

This is an official Mastra template in development. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](CONTRIBUTING.md)
