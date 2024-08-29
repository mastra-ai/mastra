import { EventHandler } from '@arkw/core';

import { TagCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const Tags: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-TagCompact`,
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
