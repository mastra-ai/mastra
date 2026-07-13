---
'mastra': minor
---

Added CLI commands to manage platform databases, environments, and deploys without leaving the terminal.

The project is resolved automatically from `MASTRA_PROJECT_ID`, the `--project <name|slug|id>` flag, or the `.mastra-project.json` written by `mastra deploy` — run the commands from your project directory and you never need to name the project.

**Databases**

```bash
mastra env db list                     # kind, status, scope, injected env var names
mastra env db list staging             # only databases feeding one environment
mastra env db create --kind turso      # shared by all environments, polls until ready
mastra env db create staging --kind turso   # scoped to one environment
mastra env db show <database>          # detail + connection env vars (secrets masked)
mastra env db detach <database>        # confirm prompt, admin only
```

`env db list` shows the attachment mapping: shared (project-scoped) databases feed all environments, environment-scoped databases feed only their environment. Provisioning failures are surfaced with the provider error instead of being swallowed.

**Environments and deploys**

```bash
mastra env list             # now shows latest deploy status + managed env var names
mastra env create staging   # explicit environment creation
mastra env restart <env>    # push saved env vars and restart the running service
mastra env deploys          # all deploys across environments, active marker
mastra env deploys staging  # only one environment's deploys
```

Breaking change to the existing `mastra env` commands: the `<project>` positional argument is replaced by the resolution above (`mastra env list <project>` → `mastra env list --project <project>`), and `mastra env create <project> -n <name>` is now `mastra env create <name>`.
