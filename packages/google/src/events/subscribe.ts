import { DataLayer, EventHandler } from '@kpl/core';

import { GoogleClient } from '../client';
import { MakeClient } from '../types';

import { GoogleIntegration } from '..';

const onSubscribeFailure = async ({
  connectionId,
  dataLayer,
  testIntegration,
  k_id,
}: {
  connectionId: string;
  k_id: string;
  dataLayer: DataLayer;
  testIntegration: Function;
}) => {
  try {
    const error = await testIntegration({
      connectionId,
    });

    if (error) {
      await dataLayer.setConnectionError({
        k_id,
        error,
      });
    }
  } catch (error) {
    // This data integration no longer exists or the connection is broken, which is an unrecoverable error. Let the
    // subscription renewal discontinue
    return;
  }
};

const gmailSubscribeAction = async ({
  client,
  connectionId,
  dataLayer,
  topic,
}: {
  dataLayer: DataLayer;
  connectionId: string;
  topic: string;
  client: GoogleClient;
}) => {
  const tokenInfo = await client.getTokenInfo();

  // This is the only identifier Gmail push notifications will send
  const subscriptionId = tokenInfo.email;

  try {
    await client.subscribeToGmail({
      topic,
    });

    console.log(`subscribed to Gmail`);

    if (subscriptionId) {
      await dataLayer.setConnectionSubscriptionId({
        subscriptionId,
        connectionId,
      });
    }
  } catch (e) {
    console.error('Error subscribing to Gmail', e);
  }
};

const gcalSubscribeAction = async ({
  dataLayer,
  k_id,
  connectionId,
  webhook_url,
  makeClient,
}: {
  dataLayer: DataLayer;
  connectionId: string;
  k_id: string;
  webhook_url: string;
  makeClient: MakeClient;
}) => {
  const client = await makeClient({ connectionId });

  const connection = await dataLayer.getConnectionById({ k_id });

  await client.stopCalendarChannel({
    channelId: k_id,
    subscriptionId: connection?.subscriptionId!,
  });

  try {
    const response = await client.subscribeToGCAL({
      webhookUrl: webhook_url,
      channelId: k_id,
    });

    console.log(`subscribed to Google Calendar`);

    const subscriptionId = response?.data?.resourceId;

    if (subscriptionId) {
      await dataLayer.setConnectionSubscriptionId({
        subscriptionId,
        k_id,
      });
    }
  } catch (e) {
    console.error(`error subscribing to calendar`, e);
  }
};

export const gmailSubscribe: EventHandler<GoogleIntegration> = ({
  eventKey,
  integrationInstance: { name, makeClient, dataLayer, sendEvent, test },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-gmail-subscribe`,
  event: eventKey,
  executor: async ({ event, step }) => {
    const { connectionId, topic } = event.data;
    const { connectionId } = event.user;
    const client = await makeClient({ connectionId });

    const connection = await dataLayer?.getConnection({ connectionId, name });

    await step.run('call-gmail-subscribe', async () => {
      await gmailSubscribeAction({ client, topic, connectionId: connection?.id!, dataLayer: dataLayer! });
    });

    await step.sleep('wait-for-resubscribe-interval', '3 days');

    /**
     * Due to the clashing nature of 'cancelOn' and this event being recursive, we must send the event outside the
     * context of the function, and with a slight delay to avoid cancelling our own events. However, as a general
     * best practice, events sent within the context of an inngest function should use step.sendEvent.
     * https://www.inngest.com/docs/reference/functions/step-send-event
     */
    await step.run('subscription-renewal', () => {
      setTimeout(() => {
        sendEvent({
          key: eventKey,
          data: {
            connectionId,
          },
          user: {
            connectionId,
          },
        });
      }, 1000);
    });
  },
  onFailure: async ({
    event,
  }: {
    event: { data: { event: { data: Record<string, any>; user: Record<string, string> } } };
  }) => {
    const { event: originalEvent } = event.data;
    const { connectionId } = originalEvent.data;
    const { connectionId } = originalEvent.user;

    await onSubscribeFailure({ connectionId, connectionId, dataLayer: dataLayer!, testIntegration: test });
  },
  cancelOn: [
    {
      event: eventKey,
      if: 'event.id != async.id && event.data.connectionId == async.data.connectionId',
    },
  ],
});

export const gcalSubscribe: EventHandler<GoogleIntegration> = ({
  eventKey,
  makeWebhookUrl,
  integrationInstance: { name, dataLayer, makeClient, sendEvent, events },
}) => ({
  id: `${name}-sync-gcal-subscribe`,
  event: eventKey,
  executor: async ({ event, step }) => {
    const { k_id } = event.data;
    const { connectionId } = event.user;

    const webhook_url = makeWebhookUrl({ event: 'sync.gCalUpdated', name });

    await step.run('call-gcal-subscribe', async () => {
      await gcalSubscribeAction({ connectionId, k_id, dataLayer: dataLayer!, webhook_url, makeClient });
    });

    await step.sleep('wait-for-resubscribe-interval', '6 days');
    /**
     * Due to the clashing nature of 'cancelOn' and this event being recursive, we must send the event outside the
     * context of the function, and with a slight delay to avoid cancelling our own events. However, as a general
     * best practice, events sent within the context of an inngest function should use step.sendEvent.
     * https://www.inngest.com/docs/reference/functions/step-send-event
     */
    await step.run('subscription-renewal', () => {
      setTimeout(() => {
        sendEvent({
          key: eventKey,
          data: {
            k_id,
          },
          user: {
            connectionId,
          },
        });
      }, 1000);
    });
  },
  onFailure: async ({
    event,
  }: {
    event: { data: { event: { data: Record<string, any>; user: Record<string, string> } } };
  }) => {
    const { event: originalEvent } = event.data;
    const { k_id } = originalEvent.data;
    const { connectionId } = originalEvent.user;

    await onSubscribeFailure({ connectionId, dataLayer: dataLayer!, testIntegration: test, k_id });
  },
  cancelOn: [
    {
      event: eventKey,
      if: 'event.id != async.id && event.data.connectionId == async.data.connectionId',
    },
  ],
});
