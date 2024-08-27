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

### _Server component_

```
import { framework } from ‘./framework-utils’; // update path accordingly

const oAuthConnectionRoute = framework?.routes.connect;

// pass oAuthConnectionRoute into the client component

<Connect oAuthConnectionRoute={oAuthConnectionRoute} />

```

### _Client component_

Connect.tsx

```
 const connect = () => {
      const params = new URLSearchParams({
        name: integrationName, //. Integration you’re trying to connect to
        connectionId: ‘’, // This is most likely your userID
        clientRedirectPath: `/records/${integrationName}`, // Where you want to redirect to.
      });

      window.location.assign(`${oAuthConnectionRoute}?${params.toString()}`);
}
```

## How to query synced data

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
