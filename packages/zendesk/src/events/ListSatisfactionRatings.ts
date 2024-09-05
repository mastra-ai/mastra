
                    import { EventHandler } from '@arkw/core';
                    import { SatisfactionRatingsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListSatisfactionRatings: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SatisfactionRatingsResponse-ListSatisfactionRatings`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/satisfaction_ratings'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListSatisfactionRatings", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SatisfactionRatingsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SatisfactionRatingsResponse`,
                                properties: SatisfactionRatingsResponseFields,
                            });
                        },
                })
                