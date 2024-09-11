import { EventHandler } from '@kepler/core';

import { WorkspaceMembershipCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const WorkspaceMembershipsForUser: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-WorkspaceMembershipCompact-WorkspaceMembershipsForUser`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { user_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/users/{user_gid}/workspace_memberships'].get({
      params: { user_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching WorkspaceMembershipsForUser', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `WorkspaceMembershipCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `WorkspaceMembershipCompact`,
      properties: WorkspaceMembershipCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
