import { EventHandler } from '@kepler/core';

import { TimePeriodCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const TimePeriods: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-TimePeriodCompact-TimePeriods`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { start_on, end_on, workspace } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/time_periods'].get({
      query: { start_on, end_on, workspace },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching TimePeriods', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `TimePeriodCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `TimePeriodCompact`,
      properties: TimePeriodCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
