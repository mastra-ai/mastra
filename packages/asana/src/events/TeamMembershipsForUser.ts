import { EventHandler } from '@arkw/core';

import { TeamMembershipCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const TeamMembershipsForUser: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-TeamMembershipCompact-TeamMembershipsForUser`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { workspace, user_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/users/{user_gid}/team_memberships'].get({
      query: { workspace },
      params: { user_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching TeamMembershipsForUser', JSON.stringify(error, null, 2));
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
