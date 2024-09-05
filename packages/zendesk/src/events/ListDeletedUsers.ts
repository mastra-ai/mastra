
                    import { EventHandler } from '@arkw/core';
                    import { DeletedUsersResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListDeletedUsers: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-DeletedUsersResponse-ListDeletedUsers`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/deleted_users'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListDeletedUsers", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `DeletedUsersResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `DeletedUsersResponse`,
                                properties: DeletedUsersResponseFields,
                            });
                        },
                })
                