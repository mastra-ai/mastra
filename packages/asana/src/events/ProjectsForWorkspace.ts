import { EventHandler } from '@arkw/core';

import { ProjectCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const ProjectsForWorkspace: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-ProjectCompact`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { limit, offset, archived, workspace_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getProxy({ referenceId });

    // @ts-ignore
    const response = await proxy['/workspaces/{workspace_gid}/projects'].get({
      query: { limit, offset, archived },
      params: { workspace_gid },
    });

    if (!response.ok) {
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `ProjectCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `ProjectCompact`,
      properties: ProjectCompactFields,
    });
  },
});
