import { EventHandler } from '@kepler/core';

import { ProjectTemplateCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const ProjectTemplates: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-ProjectTemplateCompact-ProjectTemplates`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { workspace_query_param, team_query_param, limit, offset } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/project_templates'].get({
      query: { workspace: workspace_query_param, team: team_query_param, limit, offset },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ProjectTemplates', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `ProjectTemplateCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `ProjectTemplateCompact`,
      properties: ProjectTemplateCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
