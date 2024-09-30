## Syncing and Querying Data

Every integration exposes a set of sync events. You can trigger these events using the `triggerEvent` function.

## Triggering a Sync

The easiest way to trigger a sync is to use the `triggerEvent` function.

```ts
import { Framework } from '@mastra/core';

import { config } from '../../kepler.config';

const doStuff = async () => {
  const framework = Framework.init(config);
  const client = await framework?.triggerEvent({
    key: eventKey,
    data: payload,
    user: {
      connectionId,
    },
  });
};
```

This function is used to trigger sync events in the framework.

You can trigger this manually in the admin console, set up a webhook to trigger it when data is received, or use Inngest's interval feature to schedule regular sync events in the future.

The data you sync will end up in your [Postgres database.](../reference/db-storage.md)

## Querying Synced Data

After syncing, you can query the data using Mastra's query API. Mastra wraps the Prisma ORM, so the query API is the same as the Prisma Client API.

Here's an example of how to query synced data:

```js
import { Framework } from '@mastra/core';

import { config } from '../../kepler.config';

export const getSyncedData = async ({
  connectionId,
  integrationName,
}: {
  connectionId: string,
  integrationName: string,
}) => {
  export const framework = Framework.init(config);

  const integration = framework?.getIntegration(String(integrationName).toUpperCase());

  const entityTypes = integration?.entityTypes || {};
  let k_id: string | undefined;
  const entityToRecordCountMap: Record<string, number> = {};

  if (connectionId) {
    const connection = await framework?.dataLayer.getConnection({
      connectionId,
      name: String(integrationName.toUpperCase()),
    });
    k_id = connection?.id;
  }

  if (k_id) {
    const recordCount = await framework?.dataLayer.db.entity.findMany({
      where: {
        k_id,
      },
      select: {
        type: true,
        records: true,
      },
    });

    recordCount?.reduce((acc, entity) => {
      acc[entity.type] = entity.records.length;
      return acc;
    }, entityToRecordCountMap);
  }

  return {
    entityTypes,
    entityToRecordCountMap,
  };
};
```
