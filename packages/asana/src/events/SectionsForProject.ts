import { EventHandler } from '@arkw/core';

import { SectionCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const SectionsForProject: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-SectionCompact`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { limit, offset, project_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getProxy({ referenceId });

    // @ts-ignore
    const response = await proxy['/projects/{project_gid}/sections'].get({
      query: { limit, offset },
      params: { project_gid },
    });

    if (!response.ok) {
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `SectionCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `SectionCompact`,
      properties: SectionCompactFields,
    });
  },
});
