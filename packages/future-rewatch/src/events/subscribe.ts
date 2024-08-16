import { DataLayer, MakeWebhookURL } from 'core';
// import { BaseContext } from 'inngest/types';
import { MakeClient } from '../types';

export const subscribe = ({
  event,
  name,
  makeClient,
  dataAccess,
  makeWebhookURL,
}: {
  event: string;
  name: string;
  sendEvent: Function;
  makeClient: MakeClient;
  dataAccess: DataLayer;
  makeWebhookURL: MakeWebhookURL;
}) => ({
  id: `${name}-subscribe`,
  event,
  executor: async ({ event, step }: any) => {
    const { connectionId } = event.data;

    const webhook_url = makeWebhookURL({ event: connectionId, name });
    const client = await makeClient({ connectionId });
    const connection = await dataAccess.getDataIntegrationByConnectionId(connectionId);

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
      await dataAccess.setDataIntegrationSubscriptionId({dataIntegrationId: connection.id, subscriptionId: webhook.id});
    }
  },
});
