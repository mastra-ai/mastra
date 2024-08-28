
                    import { EventHandler } from '@arkw/core';
                    import { TaskCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const Tasks: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({        
                        id: `${name}-sync-TaskCompact`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { limit,offset,assignee,project,section,workspace,completed_since,modified_since,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getProxy({ referenceId })

                         
                            const response = await proxy['/tasks'].get({
                                query: {limit,offset,assignee,project,section,workspace,completed_since,modified_since,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TaskCompact`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TaskCompact`,
                                properties: TaskCompactFields,
                            });
                        },
                })
                