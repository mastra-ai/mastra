# Running Kepler Locally

In order to run, Kepler and the Kepler admin console touch a number of different files.

1. `kepler.config.ts` -- Kepler loads your configuration file into prod. 
2. `.env` -- Kepler stores the environment variables here
3. `tsconfig.json` -- Kepler touches this in the init process in order to....
4. `package.json` -- Kepler touches this, using your package manager to install or uninstall additional integrations when you touch them from the admin console. This will modify your `package-lock.json` as well.

In addition, depending on which features you use, you may have additional files:

* The `kepler-blueprints` folder stores [workflow blueprints](./reference/workflows.md).
* The `integrations` for [local integrations](./how-to/local-integrations.md).