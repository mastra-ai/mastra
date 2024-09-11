import { EventHandler } from '@kpl/core';

import { GoalCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const ParentGoalsForGoal: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-GoalCompact-ParentGoalsForGoal`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { goal_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/goals/{goal_gid}/parentGoals'].get({
      params: { goal_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ParentGoalsForGoal', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `GoalCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `GoalCompact`,
      properties: GoalCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
