
                    import { EventHandler } from '@arkw/core';
                    import { SatisfactionReasonResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowSatisfactionRatings: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SatisfactionReasonResponse-ShowSatisfactionRatings`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { satisfaction_reason_id, satisfaction_reason_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/satisfaction_reasons/{satisfaction_reason_id}'].get({
                                query: {satisfaction_reason_id,},
                                params: {satisfaction_reason_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowSatisfactionRatings", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SatisfactionReasonResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SatisfactionReasonResponse`,
                                properties: SatisfactionReasonResponseFields,
                            });
                        },
                })
                