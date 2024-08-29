
                    import { EventHandler } from '@arkw/core';
                    import { GoalCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const Goals: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({        
                        id: `${name}-sync-GoalCompact`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { portfolio,project,is_workspace_level,team,workspace,time_periods,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getProxy({ referenceId })

                         
                            const response = await proxy['/goals'].get({
                                query: {portfolio,project,is_workspace_level,team,workspace,time_periods,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                            });
                        },
                })
                