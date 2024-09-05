
                    import { EventHandler } from '@arkw/core';
                    import { MacroResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowMacro: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-MacroResponse-ShowMacro`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  macro_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/macros/{macro_id}'].get({
                                
                                params: {macro_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowMacro", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `MacroResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `MacroResponse`,
                                properties: MacroResponseFields,
                            });
                        },
                })
                