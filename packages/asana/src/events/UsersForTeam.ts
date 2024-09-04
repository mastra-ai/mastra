import { EventHandler } from '@arkw/core';

import { UserCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const UsersForTeam: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-UserCompact-UsersForTeam`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { team_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/teams/{team_gid}/users'].get({
      params: { team_gid },
    });

    if (!response.ok) {
      console.log('error in fetching UsersForTeam', { response });
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `UserCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `UserCompact`,
      properties: UserCompactFields,
    });
  },
});
