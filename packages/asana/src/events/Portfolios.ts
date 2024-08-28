
                    import { EventHandler } from '@arkw/core';
                    import { PortfolioCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const Portfolios: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({        
                        id: `${name}-sync-PortfolioCompact`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { limit,offset,workspace,owner,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getProxy({ referenceId })

                         
                            const response = await proxy['/portfolios'].get({
                                query: {limit,offset,workspace,owner,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                            });
                        },
                })
                