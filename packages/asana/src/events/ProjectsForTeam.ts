import { EventHandler } from '@kpl/core';

import { ProjectCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const ProjectsForTeam: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-ProjectCompact-ProjectsForTeam`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { limit, offset, archived_query_param, team_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/teams/{team_gid}/projects'].get({
      query: { limit, offset, archived: archived_query_param },
      params: { team_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ProjectsForTeam', JSON.stringify(error, null, 2));
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
      lastSyncId: event?.id!,
    });
  },
});
