import { EventHandler } from '@arkw/core';

import { TagCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const Tags: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-TagCompact-Tags`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { limit, offset, workspace } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/tags'].get({
      query: { limit, offset, workspace },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching Tags', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `TagCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `TagCompact`,
      properties: TagCompactFields,
    });
  },
});
