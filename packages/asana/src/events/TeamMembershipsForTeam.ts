import { EventHandler } from '@kepler/core';

import { TeamMembershipCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const TeamMembershipsForTeam: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-TeamMembershipCompact-TeamMembershipsForTeam`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { team_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/teams/{team_gid}/team_memberships'].get({
      params: { team_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching TeamMembershipsForTeam', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `TeamMembershipCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `TeamMembershipCompact`,
      properties: TeamMembershipCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
