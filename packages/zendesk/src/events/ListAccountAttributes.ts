
                    import { EventHandler } from '@arkw/core';
                    import { SkillBasedRoutingAttributesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAccountAttributes: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SkillBasedRoutingAttributesResponse-ListAccountAttributes`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/routing/attributes'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListAccountAttributes", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SkillBasedRoutingAttributesResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SkillBasedRoutingAttributesResponse`,
                                properties: SkillBasedRoutingAttributesResponseFields,
                            });
                        },
                })
                