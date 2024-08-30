
                    import { EventHandler } from '@arkw/core';
                    import { SatisfactionRatingResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowSatisfactionRating: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SatisfactionRatingResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { satisfaction_rating_id, satisfaction_rating_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/satisfaction_ratings/{satisfaction_rating_id}'].get({
                                query: {satisfaction_rating_id,},
                                params: {satisfaction_rating_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SatisfactionRatingResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SatisfactionRatingResponse`,
                                properties: SatisfactionRatingResponseFields,
                            });
                        },
                })
                