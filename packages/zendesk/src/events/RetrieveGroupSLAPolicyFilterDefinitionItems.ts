
                    import { EventHandler } from '@arkw/core';
                    import { GroupSLAPolicyFilterDefinitionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const RetrieveGroupSLAPolicyFilterDefinitionItems: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupSLAPolicyFilterDefinitionResponse-RetrieveGroupSLAPolicyFilterDefinitionItems`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/group_slas/policies/definitions'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching RetrieveGroupSLAPolicyFilterDefinitionItems", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `GroupSLAPolicyFilterDefinitionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `GroupSLAPolicyFilterDefinitionResponse`,
                                properties: GroupSLAPolicyFilterDefinitionResponseFields,
                            });
                        },
                })
                