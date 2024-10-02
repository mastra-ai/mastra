import { EventHandler } from '@mastra/core';

import { RewatchIntegration } from '..';

export const subscribe: EventHandler<RewatchIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, makeClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-subscribe`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { connectionId } = event.user;
    const { k_id } = event.data;

    const webhook_url = makeWebhookUrl({ event: connectionId, name });
    const client = await makeClient({ connectionId });
    const connection = await dataLayer?.getConnectionById({ k_id });

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
      await dataLayer?.setConnectionSubscriptionId({ k_id: connection.id, subscriptionId: webhook.id });
    }
  },
});
