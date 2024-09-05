
                    import { EventHandler } from '@arkw/core';
                    import { ViewsCountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountViews: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ViewsCountResponse-CountViews`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/views/count'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching CountViews", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ViewsCountResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ViewsCountResponse`,
                                properties: ViewsCountResponseFields,
                            });
                        },
                })
                