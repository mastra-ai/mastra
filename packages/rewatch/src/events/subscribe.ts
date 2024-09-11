import { EventHandler } from '@kepler/core';

import { RewatchIntegration } from '..';

export const subscribe: EventHandler<RewatchIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, makeClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-subscribe`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.user;
    const { connectionId } = event.data;

    const webhook_url = makeWebhookUrl({ event: referenceId, name });
    const client = await makeClient({ referenceId });
    const connection = await dataLayer?.getConnectionById({ connectionId });

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
      await dataLayer?.setConnectionSubscriptionId({ connectionId: connection.id, subscriptionId: webhook.id });
    }
  },
});
