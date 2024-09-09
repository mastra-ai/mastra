import { EventHandler } from '@arkw/core';

import { ProjectMembershipCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const ProjectMembershipsForProject: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-ProjectMembershipCompact-ProjectMembershipsForProject`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { project_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/projects/{project_gid}/project_memberships'].get({
      params: { project_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ProjectMembershipsForProject', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `ProjectMembershipCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `ProjectMembershipCompact`,
      properties: ProjectMembershipCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
