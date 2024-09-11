import { EventHandler } from '@kpl/core';

import { TaskCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const TasksForTag: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-TaskCompact-TasksForTag`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { tag_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/tags/{tag_gid}/tasks'].get({
      params: { tag_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching TasksForTag', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `TaskCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `TaskCompact`,
      properties: TaskCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
