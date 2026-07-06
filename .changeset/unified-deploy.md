---
'mastra': patch
---

Introduced `mastra deploy`, a unified deploy command that ships a Mastra project to a named environment on the Mastra platform in a single step. The command auto-resolves the target organization, project, and environment (creating the project and environment on first deploy, with an interactive prompt or `--yes` for headless CI), builds and zips the project, uploads the artifact, and streams platform build/runtime logs in real time until the environment is running. Pass `--env <name>` to target `production` (default), `staging`, or any named environment; when `--env-file` is not given, `.env.<name>` is picked up automatically. `--region` selects the region for newly created environments.

New `mastra env` subcommands (`list`, `create`, `delete`) manage environments alongside deploys, and `--json` output makes the list and create commands scriptable for CI pipelines.

The unified deploy runs entirely against environment-scoped platform endpoints (`/v1/projects/:id/environments/...`), keeping the new runtime cleanly separate from the legacy `/v1/studio/*` surface so it can be retired independently. The existing `mastra studio deploy` and `mastra server deploy` commands continue to work unchanged for users who have not migrated; a previously landed deprecation warning on those commands has been removed so it doesn't fire before the unified path is generally available.

All three deploy commands now emit anonymous telemetry (timing, success/failure, and non-PII flag properties such as whether `--org`, `--project`, or `--env-file` were passed and whether the command ran headlessly) so regressions and adoption of the unified path can be measured. Telemetry honors `MASTRA_TELEMETRY_DISABLED`, and the platform API host is reported as a coarse label (`cloud`, `staging`, `localhost`, `custom`, or `unknown`) rather than a raw hostname so self-hosted deployments never leak their API URL.
