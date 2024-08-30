
                    import { EventHandler } from '@arkw/core';
                    import { EssentialsCardsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowEssentialsCards: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-EssentialsCardsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/object_layouts/essentials_cards'].get({
                                
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `EssentialsCardsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `EssentialsCardsResponse`,
                                properties: EssentialsCardsResponseFields,
                            });
                        },
                })
                