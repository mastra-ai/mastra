
                    import { EventHandler } from '@arkw/core';
                    import { SLAPolicyFilterDefinitionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const RetrieveSLAPolicyFilterDefinitionItems: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SLAPolicyFilterDefinitionResponse-RetrieveSLAPolicyFilterDefinitionItems`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/slas/policies/definitions'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching RetrieveSLAPolicyFilterDefinitionItems", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SLAPolicyFilterDefinitionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SLAPolicyFilterDefinitionResponse`,
                                properties: SLAPolicyFilterDefinitionResponseFields,
                            });
                        },
                })
                