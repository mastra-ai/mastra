
                    import { EventHandler } from '@arkw/core';
                    import { ProjectTemplateCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const ProjectTemplates: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({        
                        id: `${name}-sync-ProjectTemplateCompact`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { workspace_query_param,team_query_param,limit,offset,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getProxy({ referenceId })

                         
                            const response = await proxy['/project_templates'].get({
                                query: {workspace_query_param,team_query_param,limit,offset,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ProjectTemplateCompact`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ProjectTemplateCompact`,
                                properties: ProjectTemplateCompactFields,
                            });
                        },
                })
                