
                    import { EventHandler } from '@arkw/core';
                    import { SkillBasedRoutingAttributeResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowAttribute: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SkillBasedRoutingAttributeResponse-ShowAttribute`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  attribute_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/routing/attributes/{attribute_id}'].get({
                                
                                params: {attribute_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowAttribute", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SkillBasedRoutingAttributeResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SkillBasedRoutingAttributeResponse`,
                                properties: SkillBasedRoutingAttributeResponseFields,
                            });
                        },
                })
                