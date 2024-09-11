import { EventHandler } from '@kpl/core';

import { TeamCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const TeamsForUser: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-TeamCompact-TeamsForUser`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { user_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/users/{user_gid}/teams'].get({
      params: { user_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching TeamsForUser', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `TeamCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `TeamCompact`,
      properties: TeamCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
