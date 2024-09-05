
                    import { EventHandler } from '@arkw/core';
                    import { AutomationsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAutomations: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-AutomationsResponse-ListAutomations`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/automations'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListAutomations", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `AutomationsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `AutomationsResponse`,
                                properties: AutomationsResponseFields,
                            });
                        },
                })
                