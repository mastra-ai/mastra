
                    import { EventHandler } from '@arkw/core';
                    import { SkillBasedRoutingAttributeValuesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAttributeValues: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SkillBasedRoutingAttributeValuesResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  attribute_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/routing/attributes/{attribute_id}/values'].get({
                                
                                params: {attribute_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                