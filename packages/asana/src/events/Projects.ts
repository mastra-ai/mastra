import { EventHandler } from '@arkw/core';

import { ProjectCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const Projects: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-ProjectCompact`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { limit, offset, workspace, team, archived } = event.data;
    const { referenceId } = event.user;
    const proxy = await getProxy({ referenceId });

    // @ts-ignore
    const response = await proxy['/projects'].get({
      query: { limit, offset, workspace, team, archived },
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
