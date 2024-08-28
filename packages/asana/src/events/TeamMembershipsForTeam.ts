import { EventHandler } from '@arkw/core';

import { TeamMembershipCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const TeamMembershipsForTeam: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-TeamMembershipCompact`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { team_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getProxy({ referenceId });

    // @ts-ignore
    const response = await proxy['/teams/{team_gid}/team_memberships'].get({
      params: { team_gid },
    });

    if (!response.ok) {
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
    });
  },
});
