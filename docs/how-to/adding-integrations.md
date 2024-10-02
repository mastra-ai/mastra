# Adding an integration and creating a connection

Before you can use an integration, you need to add it to Mastra. If it's an OAuth-based connection, you will also need to authenticate a user in order to create a connection.

## Adding integrations

Mastra's default integrations are packaged as individually installable modules, which you can add to your project.

Before you add an integration, you need to have the relevant credentials to connect to the third-party service. This means getting an API key or a client ID and secret from the provider.

The default way to do this is to install an integration from the Mastra admin console, but you can also manually modify the files.

## Through the admin console

<!-- TODO: Add gif -->

## Manually

You can install an integration by installing the package from npm and then importing it into your `mastra-config.ts` file.

For example, for Google Calendar, you'd run:

`npm install @mastra-org/google-calendar`

Then, import it into your `mastra-config.ts` file:

```ts
import { GoogleCalendarIntegration } from '@mastra-org/google-calendar';

// rest of config

export const config: Config = {
  ...restOfConfig,
  integrations: [
    new GoogleCalendarIntegration({
      config: {
        CLIENT_ID: process.env.KENNY_CLIENT_ID!,
        CLIENT_SECRET: process.env.KENNY_CLIENT_SECRET!,
        SCOPES: undefined,
      },
    }),
    ...restOfIntegrations,
  ],
};
```

## Creating a connection

<!-- TODO: Add docs -->
