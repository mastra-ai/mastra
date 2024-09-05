
                    import { EventHandler } from '@arkw/core';
                    import { SLAPoliciesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListSLAPolicies: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SLAPoliciesResponse-ListSLAPolicies`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/slas/policies'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListSLAPolicies", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SLAPoliciesResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SLAPoliciesResponse`,
                                properties: SLAPoliciesResponseFields,
                            });
                        },
                })
                