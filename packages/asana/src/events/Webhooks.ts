import { EventHandler } from '@kpl/core';

import { WebhookResponseFields } from '../constants';

import { AsanaIntegration } from '..';

export const Webhooks: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-WebhookResponse-Webhooks`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { limit, offset, workspace, resource } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/webhooks'].get({
      query: { limit, offset, workspace, resource },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching Webhooks', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `WebhookResponse`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `WebhookResponse`,
      properties: WebhookResponseFields,
      lastSyncId: event?.id!,
    });
  },
});
