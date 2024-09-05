
                    import { EventHandler } from '@arkw/core';
                    import { DeletedUserResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowDeletedUser: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-DeletedUserResponse-ShowDeletedUser`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  deleted_user_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/deleted_users/{deleted_user_id}'].get({
                                
                                params: {deleted_user_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowDeletedUser", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `DeletedUserResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `DeletedUserResponse`,
                                properties: DeletedUserResponseFields,
                            });
                        },
                })
                