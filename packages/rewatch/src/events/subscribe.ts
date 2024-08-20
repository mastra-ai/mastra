import { DataLayer, MakeWebhookURL } from '@arkw/core';

// import { BaseContext } from 'inngest/types';
import { MakeClient } from '../types';

export const subscribe = ({
  event,
  name,
  makeClient,
  dataAccess,
  makeWebhookUrl,
}: {
  event: string;
  name: string;
  sendEvent: Function;
  makeClient: MakeClient;
  dataAccess: DataLayer;
  makeWebhookUrl: MakeWebhookURL;
}) => ({
  id: `${name}-subscribe`,
  event,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.data;

    const webhook_url = makeWebhookUrl({ event: referenceId, name });
    const client = await makeClient({ referenceId });
    const connection = await dataAccess.getConnectionByReferenceId(referenceId);

    let webhook;
    if (connection?.subscriptionId) {
      webhook = await client.getWebhook(connection.subscriptionId);
      if (webhook) {
        return;
      }
    }

    if (!webhook) {
      webhook = await client.subscribe(webhook_url);
    }

    if (connection) {
      await dataAccess.setConnectionSubscriptionId({ connectionId: connection.id, subscriptionId: webhook.id });
    }
  },
});
