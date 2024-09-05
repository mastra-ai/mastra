
                    import { EventHandler } from '@arkw/core';
                    import { SatisfactionRatingsCountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountSatisfactionRatings: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SatisfactionRatingsCountResponse-CountSatisfactionRatings`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/satisfaction_ratings/count'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching CountSatisfactionRatings", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SatisfactionRatingsCountResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SatisfactionRatingsCountResponse`,
                                properties: SatisfactionRatingsCountResponseFields,
                            });
                        },
                })
                