import { EventHandler } from '@kpl/core';

import { PortfolioCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const Portfolios: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-PortfolioCompact-Portfolios`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { limit, offset, workspace, owner } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/portfolios'].get({
      query: { limit, offset, workspace, owner },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching Portfolios', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `PortfolioCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `PortfolioCompact`,
      properties: PortfolioCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
