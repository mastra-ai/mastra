
                    import { EventHandler } from '@arkw/core';
                    import { PortfolioMembershipCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const PortfolioMembershipsForPortfolio: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PortfolioMembershipCompact-PortfolioMembershipsForPortfolio`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  portfolio_gid,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/portfolios/{portfolio_gid}/portfolio_memberships'].get({
                                
                                params: {portfolio_gid,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                })
                