# Admin Console

## Initialize CLI

1. `npx @mastra init` or `pnpx @mastra init`
2. When prompted, supply the necessary credentials:

## Configure Next.js project

### _next.config.mjs_

Update nextConfig with esmExternals: 'loose'

```
const nextConfig = {
  experimental: {
      esmExternals: 'loose',
  }
}

export default nextConfig;
```

## Setup framework-utils

### _framework-utils.ts_

```
import { createFramework } from ‘@mastra/core’
import { config } from ‘mastra.config.ts // update path accordingly

export const framework = createFramework(config)
```

## How to wire a connect button

### _GoogleConnectButton.tsx_

```
import { framework } from ‘./framework-utils’; // update path accordingly

const GoogleConnectButton = () => {
  const router = framework.createRouter()
  const OAuthConnectionRoute = router?.makeConnectURI({
    name: 'Google' // Integration name
    connectionId: ‘user-1’, // This is most likely your userID
    clientRedirectPath: "/", // Where you want to redirect to after successful connection.
  });

  return (
      <a href={OAuthConnectionRoute}>Connect with Google</a>
  )
}
```

## How to query synced data

### _Server component_

```
import { framework } from ‘./framework-utils’; // update path accordingly

const recordData = await framework.getIntegration('GOOGLE)?.query({
     connectionId: `1`,
     entityType: 'CONTACTS',
     filters: {
       'data.email': {
         contains: 'mail',
       },
     },
     sort: ['asc(createdAt)', 'desc(updatedAt)'],
});
```

## Execute an action

```
const res = await framework.executeAction({
      integrationName: 'GOOGLE',
      action: 'SEND_EMAIL',
      payload: {
        data: {
          to: emails,
          subject,
          body,
        },
        ctx: {
          connectionId: 'user-1',
        },
      },
});
```
