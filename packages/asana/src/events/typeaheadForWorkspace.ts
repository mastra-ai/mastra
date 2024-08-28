
                    import { EventHandler } from '@arkw/core';
                    import { AsanaNamedResourceFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const typeaheadForWorkspace: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({        
                        id: `${name}-sync-AsanaNamedResource`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  workspace_gid,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getProxy({ referenceId })

                         
                            const response = await proxy['/workspaces/{workspace_gid}/typeahead'].get({
                                
                                params: {workspace_gid,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `AsanaNamedResource`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `AsanaNamedResource`,
                                properties: AsanaNamedResourceFields,
                            });
                        },
                })
                