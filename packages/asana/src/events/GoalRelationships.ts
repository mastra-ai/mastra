import { EventHandler } from '@arkw/core';

import { GoalRelationshipCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const GoalRelationships: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-GoalRelationshipCompact-GoalRelationships`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { pretty, fields, supported_goal, resource_subtype } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/goal_relationships'].get({
      query: { opt_pretty: pretty, opt_fields: fields, supported_goal, resource_subtype },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching GoalRelationships', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `GoalRelationshipCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `GoalRelationshipCompact`,
      properties: GoalRelationshipCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
