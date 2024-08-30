
                    import { EventHandler } from '@arkw/core';
                    import { RelationshipFilterDefinitionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const GetRelationshipFilterDefinitions: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-RelationshipFilterDefinitionResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { target_type,source_type, target_type,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/relationships/definitions/{target_type}'].get({
                                query: {target_type,source_type,},
                                params: {target_type,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `RelationshipFilterDefinitionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `RelationshipFilterDefinitionResponse`,
                                properties: RelationshipFilterDefinitionResponseFields,
                            });
                        },
                })
                