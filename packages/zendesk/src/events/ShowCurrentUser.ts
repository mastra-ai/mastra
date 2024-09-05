
                    import { EventHandler } from '@arkw/core';
                    import { CurrentUserResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowCurrentUser: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CurrentUserResponse-ShowCurrentUser`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/users/me'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ShowCurrentUser", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CurrentUserResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CurrentUserResponse`,
                                properties: CurrentUserResponseFields,
                            });
                        },
                })
                