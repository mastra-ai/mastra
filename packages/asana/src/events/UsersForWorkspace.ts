
                    import { EventHandler } from '@arkw/core';
                    import { UserCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const UsersForWorkspace: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-UserCompact`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  workspace_gid,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/workspaces/{workspace_gid}/users'].get({
                                
                                params: {workspace_gid,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `UserCompact`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `UserCompact`,
                                properties: UserCompactFields,
                            });
                        },
                })
                