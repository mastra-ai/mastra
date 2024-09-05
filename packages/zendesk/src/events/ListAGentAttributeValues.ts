
                    import { EventHandler } from '@arkw/core';
                    import { SkillBasedRoutingAttributeValuesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAGentAttributeValues: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SkillBasedRoutingAttributeValuesResponse-ListAGentAttributeValues`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  user_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/routing/agents/{user_id}/instance_values'].get({
                                
                                params: {user_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ListAGentAttributeValues", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SkillBasedRoutingAttributeValuesResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SkillBasedRoutingAttributeValuesResponse`,
                                properties: SkillBasedRoutingAttributeValuesResponseFields,
                            });
                        },
                })
                