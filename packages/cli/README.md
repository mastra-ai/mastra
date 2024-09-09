## Installation

`npm install -g kpl`

## Commands:

`kpl init`

Initializes a new project.

Run this from the root of the Next.js app you want to add Kepler to. This will create a `kepler.config.ts` file in the root of your project, a `docker-compose.yml` file in the root of your project, and a `.env` file in the root of your project.

**Flags:**

`-c`, `--connection-string`: The port to use for the Postgres db. If not provided, will prompt the user.
`-b`, `--broker`: The url to use for Inngest. If not provided, will prompt the user.

`kpl admin`

Starts the admin server

`kpl generate`

Generates types

`kpl migrate`

Migrate the kepler database forward
