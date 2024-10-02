## Syncing Data with Mastra Integrations

## Event-Driven Sync

Mastra uses an event-driven approach for syncing data from third-party services. By convention, sync events are specified in the format:

`<integration>.<entity>/sync`

For example, `asana.TasksForProject/sync` or `google.emailSync/sync`.

## Triggering a Sync

The easiest way to trigger a sync is to use the `triggerSystemEvent` function.

This function is used to trigger sync events in the framework. You can trigger this manually in the admin console, set up a webhook to trigger it when data is received, or use Inngest's interval feature to schedule regular sync events in the future.

## Querying Synced Data

After syncing, you can query the data using Mastra's query API. Mastra wraps the Prisma ORM, so the query API is the same as the Prisma Client API.

Here's an example of how to query synced data:

```js
import { framework } from '@/lib/framework-utils';

export const getSyncedData = async ({
  connectionId,
  integrationName,
}: {
  connectionId: string,
  integrationName: string,
}) => {
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
