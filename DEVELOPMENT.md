# GETTING STARTED

The steps below will assume you have locally installed the necessary dependencies.
Other dependencies will be installed as part of the setup

- **node** (>=20)
- **pnpm** (>=9.7.0)
- **docker** (only necessary to run test locally)

## LOCAL DEVELOPMENT

From the project root, run the following commands

- **Install the project dependencies** by running `pnpm setup`

## TESTING

We only have units tests for now.

### Unit tests

Unit tests are contained in all packages. You need to do a few things to run tests:

1. Build the packages by running `pnpm build`.
2. Start your local db dev container by running `pnpm run dev:services:up`.
3. Duplicate and rename `.env.example` to `.env`.
4. Run `pnpm test` to run all tests.
   You can also go into any package and run `pnpm test` to run tests for the package.

- Note: Tests requiring api keys might fail unless they're provide but you don't have to worry about the api keys as CI tests will run when you create a PR against main.

## DOCKER

Mastra provides a docker-compose file to aid with setting up db infrastructure.
While it should allow for a generic setup, it might need to be modified to fit your infrastructure.

From the project root, run the following commands

- **Run docker image from compose** by running `pnpm run dev:services:up`

Other useful command

- **Stopping the running process** by running `pnpm run dev:services:down`

# Releasing

1. Create a `changeset` with your changes

For alpha releases run this first:

```
pnpm changeset pre enter alpha
```

then

```
pnpm changeset
```

2. Open your PR
