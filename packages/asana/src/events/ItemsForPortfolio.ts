import { EventHandler } from '@arkw/core';

import { ProjectCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const ItemsForPortfolio: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-ProjectCompact-ItemsForPortfolio`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { portfolio_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/portfolios/{portfolio_gid}/items'].get({
      params: { portfolio_gid },
    });

    if (!response.ok) {
      console.log('error in fetching ItemsForPortfolio', { response });
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
