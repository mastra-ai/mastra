# Running Mastra Locally

In order to run locally, Mastra needs a local Postgres database and a local Inngest server, both of which can be installed with Docker through the `init` command, which installs a `mastra.docker-compose.yml` file.

In addition, Mastra's `init` command and admin console create or touch a number of other files:

1. `mastra.config.ts`. `mastra init` will create this file with the appropriate Postgres and Inngest connection strings. When you install a new integration through the admin console, it will modify this to add in the new integration information.
2. `.env` -- When you install a new integration and enter in your app id and secrets, Mastra will store them in your `.env` file with the format `${APP_NAME}_CLIENT_ID` and `${APP_NAME}_CLIENT_SECRET`.
3. `tsconfig.json`. Mastra adds some aliases to your `tsconfig.json` file to make it easier to import packages.
4. `package.json` and `package-lock.json`. When you install additional integrations through the Mastra admin console, your package manager will install them from `npm`, which modifies these files.

In addition, depending on which features you use, you may have additional files:

- The `mastra-blueprints` folder stores [workflow blueprints](./reference/workflows.md).
- The `integrations` for [local integrations](./how-to/local-integrations.md).
