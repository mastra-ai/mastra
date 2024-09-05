
                    import { EventHandler } from '@arkw/core';
                    import { TargetsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTars: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TargetsResponse-ListTars`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/targets'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListTars", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TargetsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TargetsResponse`,
                                properties: TargetsResponseFields,
                            });
                        },
                })
                