
                    import { EventHandler } from '@arkw/core';
                    import { RelationshipFilterDefinitionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const GetRelationshipFilterDefinitions: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-RelationshipFilterDefinitionResponse-GetRelationshipFilterDefinitions`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { target_type,source_type, target_type,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/relationships/definitions/{target_type}'].get({
                                query: {target_type,source_type,},
                                params: {target_type,} })

                            if (!response.ok) {
                              console.log("error in fetching GetRelationshipFilterDefinitions", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
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
                