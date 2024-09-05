
                    import { EventHandler } from '@arkw/core';
                    import { UserFieldsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListUserFields: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-UserFieldsResponse-ListUserFields`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/user_fields'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListUserFields", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `UserFieldsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `UserFieldsResponse`,
                                properties: UserFieldsResponseFields,
                            });
                        },
                })
                