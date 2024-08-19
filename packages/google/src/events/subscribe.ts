import { DataLayer, EventHandler, MakeWebhookURL } from '@arkw/core';

import { GoogleClient } from '../client';
import { MakeClient } from '../types';

const onSubscribeFailure = async ({
  connectionId,
  dataLayer,
  testIntegration,
  referenceId,
}: {
  connectionId: string;
  referenceId: string;
  dataLayer: DataLayer;
  testIntegration: Function;
}) => {
  try {
    const error = await testIntegration({
      referenceId,
    });

    if (error) {
      await dataLayer.setConnectionError({
        connectionId,
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
  referenceId,
  connectionId,
  webhook_url,
  makeClient,
}: {
  dataLayer: DataLayer;
  connectionId: string;
  referenceId: string;
  webhook_url: string;
  makeClient: MakeClient;
}) => {
  const client = await makeClient({ referenceId });

  await client.stopCalendarChannel();

  try {
    const response = await client.subscribeToGCAL({
      webhookUrl: webhook_url,
      channelId: connectionId,
    });

    console.log(`subscribed to calendar ${response?.data?.resourceId}`);

    const subscriptionId = response?.data?.resourceId;
    if (subscriptionId) {
      await dataLayer.setConnectionSubscriptionId({
        subscriptionId,
        connectionId,
      });
    }
  } catch (e) {
    console.error(`error subscribing to calendar`, e);
  }
};

export const gmailSubscribe = ({
  name,
  event,
  sendEvent,
  topic,
  makeClient,
  dataLayer,
  testIntegration,
}: {
  event: string;
  name: string;
  sendEvent: Function;
  topic: string;
  makeClient: MakeClient;
  dataLayer: DataLayer;
  testIntegration: Function;
}): EventHandler => ({
  id: `${name}-sync-gmail-subscribe`,
  event,
  executor: async ({ event, step }) => {
    const { connectionId } = event.data;
    const { referenceId } = event.user;
    const client = await makeClient({ referenceId });

    const connection = await dataLayer.getConnectionByReferenceId({ referenceId, name });

    await step.run('call-gmail-subscribe', async () => {
      await gmailSubscribeAction({ client, topic, connectionId: connection?.id!, dataLayer });
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
          name: `${name}/sync.gmailSubscribe`,
          data: {
            connectionId,
          },
          user: {
            referenceId,
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
    const { referenceId } = originalEvent.user;

    await onSubscribeFailure({ referenceId, connectionId, dataLayer, testIntegration });
  },
  cancelOn: [
    {
      event,
      if: 'event.id != async.id && event.data.connectionId == async.data.connectionId',
    },
  ],
});

export const gcalSubscribe = ({
  sendEvent,
  event,
  name,
  makeWebhookURL,
  makeClient,
  dataLayer,
  testIntegration,
}: {
  sendEvent: Function;
  event: string;
  name: string;
  makeWebhookURL: MakeWebhookURL;
  makeClient: MakeClient;
  dataLayer: DataLayer;
  testIntegration: Function;
}): EventHandler => ({
  id: `${name}-sync-gcal-subscribe`,
  event,
  executor: async ({ event, step }) => {
    const { connectionId } = event.data;
    const { referenceId } = event.user;

    const webhook_url = makeWebhookURL({ event: 'GCAL_UPDATE', name });

    await step.run('call-gcal-subscribe', async () => {
      await gcalSubscribeAction({ referenceId, connectionId, dataLayer, webhook_url, makeClient });
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
          name: 'google/sync.gcalSubscribe',
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
    const { referenceId } = originalEvent.user;

    await onSubscribeFailure({ connectionId, dataLayer, testIntegration, referenceId });
  },
  cancelOn: [
    {
      event,
      if: 'event.id != async.id && event.data.connectionId == async.data.connectionId',
    },
  ],
});
