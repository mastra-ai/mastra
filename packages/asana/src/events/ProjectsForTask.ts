
                    import { EventHandler } from '@arkw/core';
                    import { ProjectCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const ProjectsForTask: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({        
                        id: `${name}-sync-ProjectCompact`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  task_gid,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getProxy({ referenceId })

                         
                            const response = await proxy['/tasks/{task_gid}/projects'].get({
                                
                                params: {task_gid,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                })
                