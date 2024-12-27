# GETTING STARTED

The steps below will assume you have locally installed the necessary dependencies.
Other dependencies will be installed as part of the setup

- **node** (>=20)
- **pnpm** (>=9.7.0)
- **docker** (only necessary to run test locally)

## LOCAL DEVELOPMENT

From the project root, run the following commands

- **Install the project dependencies** by running `pnpm setup`

## ADDING A NEW INTEGRATION

1. In your code editor, open the file at `integration-generator/source.ts`.
2. Locate the exported array named `sources`.
3. Add a new object that follows this shape (note that for now, we only support `authType: 'API_KEY'`):

   ```
   {
     name: 'myIntegration',
     logoDomain: 'myintegration.com',
     authType: 'API_KEY',
     openapiSpec: 'https://myintegration.com/openapi.yaml',
     serverUrl: 'https://api.myintegration.com',
     apiKeys: ['API_KEY'],
     authorization: {
       type: 'Bearer',
       tokenKey: 'API_KEY',
     },
     categories: ['myCategory'],
     description: 'An optional but helpful description.',
   },
   ```

4. Once you finish adding your integration, run:

   ```
   pnpm run generate:integration
   ```

   This command creates your integration. You can find it in the `integrations` folder.

5. Navigate to your newly created integration in the `integrations/myIntegration` directory, then run:
   ```
   pnpm run gen:zod:schema
   ```
   This command finalizes the schema generation for your integration.

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
