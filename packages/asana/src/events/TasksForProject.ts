
                    import { EventHandler } from '@arkw/core';
                    import { TaskCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const TasksForProject: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({        
                        id: `${name}-sync-TaskCompact`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  project_gid,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getProxy({ referenceId })

                         
                            const response = await proxy['/projects/{project_gid}/tasks'].get({
                                
                                params: {project_gid,} })

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
                