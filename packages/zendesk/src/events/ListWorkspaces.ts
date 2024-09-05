
                    import { EventHandler } from '@arkw/core';
                    import { WorkspaceResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListWorkspaces: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-WorkspaceResponse-ListWorkspaces`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/workspaces'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListWorkspaces", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `WorkspaceResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `WorkspaceResponse`,
                                properties: WorkspaceResponseFields,
                            });
                        },
                })
                