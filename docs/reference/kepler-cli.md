# The Kepler CLI

The Kepler CLI has the following commands:

`kepler init`

This does a few things:
- **Create files**. It creates a `kepler.config.ts` file with the appropriate Postgres and Inngest connection strings. It also creates a `.env` file for storing your environment variables.

`kepler provision`

This prompts you for your Postgres and Inngest connection strings, and spins up a Docker container with the resources you don't have.

`kepler migrate`

This migrates your Postgres database to add [Kepler's schema](./db-storage.md) to it so it can store synced records. 

`kepler admin`

This spins up the Kepler admin console, which you can use to install integrations, manage synced records, and trigger workflows.
