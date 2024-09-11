import { EventHandler } from '@kepler/core';

import { EventResponseFields } from '../constants';

import { AsanaIntegration } from '..';

export const Events: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-EventResponse-Events`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const {} = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/events'].get({});

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching Events', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `EventResponse`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `EventResponse`,
      properties: EventResponseFields,
      lastSyncId: event?.id!,
    });
  },
});
