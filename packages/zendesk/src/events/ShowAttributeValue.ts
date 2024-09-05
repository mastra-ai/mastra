
                    import { EventHandler } from '@arkw/core';
                    import { SkillBasedRoutingAttributeValueResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowAttributeValue: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SkillBasedRoutingAttributeValueResponse-ShowAttributeValue`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  attribute_id,attribute_value_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/routing/attributes/{attribute_id}/values/{attribute_value_id}'].get({
                                
                                params: {attribute_id,attribute_value_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowAttributeValue", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SkillBasedRoutingAttributeValueResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SkillBasedRoutingAttributeValueResponse`,
                                properties: SkillBasedRoutingAttributeValueResponseFields,
                            });
                        },
                })
                