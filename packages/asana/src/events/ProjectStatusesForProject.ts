import { EventHandler } from '@kpl/core';

import { ProjectStatusCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const ProjectStatusesForProject: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-ProjectStatusCompact-ProjectStatusesForProject`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { pretty, fields, limit, offset, project_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/projects/{project_gid}/project_statuses'].get({
      query: { opt_fields: fields, opt_pretty: pretty, limit, offset },
      params: { project_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ProjectStatusesForProject', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `ProjectStatusCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `ProjectStatusCompact`,
      properties: ProjectStatusCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
