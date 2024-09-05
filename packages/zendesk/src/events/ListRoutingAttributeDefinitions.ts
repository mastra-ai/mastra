
                    import { EventHandler } from '@arkw/core';
                    import { SkillBasedRoutingAttributeDefinitionsFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListRoutingAttributeDefinitions: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SkillBasedRoutingAttributeDefinitions-ListRoutingAttributeDefinitions`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/routing/attributes/definitions'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListRoutingAttributeDefinitions", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SkillBasedRoutingAttributeDefinitions`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SkillBasedRoutingAttributeDefinitions`,
                                properties: SkillBasedRoutingAttributeDefinitionsFields,
                            });
                        },
                })
                