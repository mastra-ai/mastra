# Running Mastra Locally

Mastra sits inside your existing Next.js app. Its `init` command and admin console create or touch a number of files. Some it expects to own; others it simply modifies.

## Files Mastra owns

1. `mastra.config.ts`. 

`mastra init` will create this file with the appropriate Postgres and Inngest connection strings. When you install a new integration through the admin console, it will modify this to add in the new integration information.

2. `mastra.docker-compose.yml`.

In order to run locally, Mastra needs a local Postgres database and a local Inngest server, both of which can be installed with Docker through the `init` command, which installs a `mastra.docker-compose.yml` file.

3. Routing file. 

Mastra auto-generates a file for your app to use. The convention plays nicely with the [Next.js app router](https://nextjs.org/docs/app).

4. (optional) `/mastra-blueprints/`

The `mastra-blueprints` folder stores [workflow blueprints](./reference/workflows.md).

5. (optional) `/integrations/`

Stores [local integrations](./how-to/local-integrations.md).

## Files Mastra modifies

The Mastra admin console modifies the following files:

1. `.env`.

When you install a new integration and enter in your app id and secrets, Mastra will store them in your `.env` file with the format `${APP_NAME}_CLIENT_ID` and `${APP_NAME}_CLIENT_SECRET`.

2. `tsconfig.json`. 

Mastra adds some aliases to your `tsconfig.json` file to make it easier to import packages.

3. `package.json` and `package-lock.json`. 

When you install additional integrations through the Mastra admin console, your package manager will install them from `npm`, which modifies these files.