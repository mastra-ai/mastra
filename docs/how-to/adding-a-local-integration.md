## Adding a New Local Integration

Kepler allows you to add your own integrations locally, if you want to integrate with a third-party API that isn't supported already.

There are three things you need to configure:

1. Basic integration details in `integrations/integrations.json`
2. Export an integration class from a folder in `integrations/`
3. Import the integration in `kepler-config.ts`

## Step 1: Add integration details

Kepler looks for an `integrations` directory in the root of the repo, and expects to find a file called `integrations.json` in there.

Here's an example of what the file should look like:

```json
[
  {
    "name": "Sample Integration",
    "packageName": "sample-integration",
    "logoUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
    "authType": "OAUTH",
    "availableScopes": ["read", "write"],
    "config": {},
    "isUserDefined": true
  }
]
```

## Step 2: Export an integration class

Create a folder named after the integration in `integrations/` and add an `index.ts` file.

```ts
import { Integration, IntegrationAuth, IntegrationCredentialType } from '@kpl/core';

export class SampleIntegration extends Integration {
  constructor({ config }: { config: Record<string, any> }) {
    super({
      name: 'Sample Integration',
      logoUrl:
        'data:image/png;base64,iVBORw0KGgoAAAAAANSUhEUgAAAIAAAAACACAAAAYAAADDPmHLAAAYTELEQVR4n0x9CXxU5fX2c997Z8tMFsKaBJIgaLEbYmm',
    });
  }

  getAuthenticator() {
    return new IntegrationAuth({
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: IntegrationCredentialType.OAUTH,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: 'https://app.iroko.com',
        AUTHORIZATION_ENDPOINT: '/-/oauth_authorize/',
        TOKEN_ENDPOINT: '/-/oauth_token/',
        SCOPES: [],
      },
      dataAccess: this.dataLayer!,
    });
  }
}
```

### Step 3: Import the integration in `kepler-config.ts`

```ts
import { SampleIntegration } from './integrations/sample-integration';

// rest of config

export const config: Config = {
  ...restOfConfig,
  integrations: [
    new SampleIntegration({
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
