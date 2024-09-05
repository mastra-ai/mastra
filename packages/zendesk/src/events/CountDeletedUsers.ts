
                    import { EventHandler } from '@arkw/core';
                    import { CountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountDeletedUsers: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CountResponse-CountDeletedUsers`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/deleted_users/count'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching CountDeletedUsers", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CountResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CountResponse`,
                                properties: CountResponseFields,
                            });
                        },
                })
                