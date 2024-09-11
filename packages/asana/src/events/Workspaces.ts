import { EventHandler } from '@kepler/core';

import { WorkspaceCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const Workspaces: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-WorkspaceCompact-Workspaces`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const {} = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/workspaces'].get({});

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching Workspaces', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `WorkspaceCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `WorkspaceCompact`,
      properties: WorkspaceCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
