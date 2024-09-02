
                    import { EventHandler } from '@arkw/core';
                    import { ProjectCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const ProjectsForWorkspace: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ProjectCompact`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { limit,offset,archived_query_param, workspace_gid,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/workspaces/{workspace_gid}/projects'].get({
                                query: {limit,offset,archived_query_param,},
                                params: {workspace_gid,} })

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
                