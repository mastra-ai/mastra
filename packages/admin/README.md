# Admin Console

## Initialize CLI

1. `npx @arkw init` or `pnpx @arkw init`
2. When prompted, supply the necessary credentials:

## Setup framework-utils

### _framework-utils.ts_

```
import { createFramework } from ‘@arkw/core’
import { config } from ‘arkw.config.ts // update path accordingly

export const framework = createFramework(config)
```

## How to wire a connect button

GoogleConnectButton.tsx

```
import { framework } from ‘./framework-utils’; // update path accordingly

const GoogleConnectButton = () => {
  const OAuthConnectionRoute = framework?.makeConnectURI({
    name: 'Google' // Integration name
    referenceId: ‘user-1’, // This is most likely your userID
    clientRedirectPath: "/", // Where you want to redirect to after successful connection.
  });

  return (
      <a href={OAuthConnectionRoute}>Connect with Google</a>
  )
}
```

## How to query synced data

// TODO: work on this bit.

### _Server component_

```
import { framework } from ‘./framework-utils’; // update path accordingly

const recordData = await framework.getIntegration(integrationName.toUpperCase())?.query({
     referenceId: `1`,
     entityType: 'CONTACTS',
     filters: {
       'data.email': {
         contains: 'mail',
       },
     },
     sort: ['asc(createdAt)', 'desc(updatedAt)'],
});
```
