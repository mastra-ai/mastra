import { EventHandler } from '@arkw/core';

import { PortfolioMembershipCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const PortfolioMemberships: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-PortfolioMembershipCompact`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const {} = event.data;
    const { referenceId } = event.user;
    const proxy = await getProxy({ referenceId });

    // @ts-ignore
    const response = await proxy['/portfolio_memberships'].get({});

    if (!response.ok) {
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `PortfolioMembershipCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `PortfolioMembershipCompact`,
      properties: PortfolioMembershipCompactFields,
    });
  },
});
