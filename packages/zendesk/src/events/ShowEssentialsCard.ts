
                    import { EventHandler } from '@arkw/core';
                    import { EssentialsCardResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowEssentialsCard: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-EssentialsCardResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  object_type,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/object_layouts/{object_type}/essentials_card'].get({
                                
                                params: {object_type,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `EssentialsCardResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `EssentialsCardResponse`,
                                properties: EssentialsCardResponseFields,
                            });
                        },
                })
                