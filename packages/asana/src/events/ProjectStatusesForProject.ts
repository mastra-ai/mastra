
                    import { EventHandler } from '@arkw/core';
                    import { ProjectStatusCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const ProjectStatusesForProject: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ProjectStatusCompact`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { project_path_gid,pretty,fields,limit,offset, project_gid,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/projects/{project_gid}/project_statuses'].get({
                                query: {project_path_gid,pretty,fields,limit,offset,},
                                params: {project_gid,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ProjectStatusCompact`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ProjectStatusCompact`,
                                properties: ProjectStatusCompactFields,
                            });
                        },
                })
                