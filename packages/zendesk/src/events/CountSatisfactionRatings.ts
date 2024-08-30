
                    import { EventHandler } from '@arkw/core';
                    import { SatisfactionRatingsCountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountSatisfactionRatings: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SatisfactionRatingsCountResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/satisfaction_ratings/count'].get({
                                
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                