import { EventHandler } from '@arkw/core';

import { TeamCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const TeamsForWorkspace: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-TeamCompact-TeamsForWorkspace`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { workspace_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/workspaces/{workspace_gid}/teams'].get({
      params: { workspace_gid },
    });

    if (!response.ok) {
      console.log('error in fetching TeamsForWorkspace', { response });
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `TeamCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `TeamCompact`,
      properties: TeamCompactFields,
    });
  },
});
