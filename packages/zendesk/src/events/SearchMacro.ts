
                    import { EventHandler } from '@arkw/core';
                    import { MacrosResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const SearchMacro: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-MacrosResponse-SearchMacro`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/macros/search'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching SearchMacro", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `MacrosResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `MacrosResponse`,
                                properties: MacrosResponseFields,
                            });
                        },
                })
                