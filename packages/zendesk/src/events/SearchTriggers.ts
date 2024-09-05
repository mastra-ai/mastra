
                    import { EventHandler } from '@arkw/core';
                    import { TriggersResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const SearchTriggers: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TriggersResponse-SearchTriggers`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/triggers/search'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching SearchTriggers", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TriggersResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TriggersResponse`,
                                properties: TriggersResponseFields,
                            });
                        },
                })
                