# Running and verifying intake

Use the runtime declared in `package.json` (Node 24). The install path is `npm install`; its dependency-free postinstall creates the local directory and copies the environment example only if `.env` is absent. Existing configuration is preserved. All direct Mastra dependencies use `latest`; the lockfile records the installation tested for this template.

Use standard `npm run dev`, `npm run build` and `npm start`. Development serves Studio and the API on port 4111. Run commands from the template directory. The application resolves the native CLI working-root hint to the enclosing project directory, so both standard dev and start use the same persistent `data/` directory even though their generated servers run elsewhere. Stop one process before starting another. A production process needs the environment settings in the configuration guide and HTTPS ingress.

The standard Mastra server handles HTTP. Route registration starts a small bounded dispatcher, including recovery before the next event arrives. Merely importing configuration for a build does not dispatch pending work. Dispatch records the stable run ID before native execution. On restart it reconciles a stored successful workflow, restarts interrupted running snapshots, and starts work with no snapshot. Direct native calls cannot supply the private trusted dispatch binding or create an operational association.

Graceful SIGINT/SIGTERM stops dispatch and closes the application. Since the configuration module manages embedded-store shutdown, it does not drain HTTP connections itself. Intake in progress may return a transport error; replay the same event ID after restart to discover whether its durable association committed. SIGKILL recovery uses the same mechanism for accepted pending work. Deployment requires one process and persistent disk; multiple replicas and ephemeral/serverless storage are unsupported.

## Checks

Run the focused suites before broader execution:

```sh
npm test -- tests/unit
npm test -- tests/integration
npm run format:check
npm run lint
npm run typecheck
npm run build
```

Integration tests use isolated temporary persistent databases, the native Mastra HTTP adapter, controlled failures and a real child-process SIGKILL/restart. They make no OpenAI or Attio calls. Tests and fixtures are under `tests/`; no live service credentials are required.

## Backups and rollback

Stop the process, then make a consistent backup of the whole `data/` directory before changing persisted schemas or reverting application code. The initial schema is additive and has no destructive migration. Reverting to the earlier scaffold leaves the ignored data files for diagnosis, but that scaffold cannot resume intake. Restore this implementation with the same data to recover pending runs. Do not delete accepted operational data during rollback.

There is no destructive retention command in this version. For disposable development data, stop the server and explicitly choose whether to archive or remove it. Production use needs an operator-managed data lifecycle until retention maintenance is implemented.

Customization prompt:

> Adapt operations for [deployment] while preserving standard Mastra dev/build/start, one process, persistent LibSQL/DuckDB files, production authentication and durable replay. Keep operational scripts in scripts/ and tests under tests/. Test acceptance-to-dispatch interruption with an actual child-process kill, successful restart and exactly one logical run association. Document shutdown, backup and schema rollback behavior.
