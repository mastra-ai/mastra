
                    import { EventHandler } from '@arkw/core';
                    import { TicketsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketsFromView: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketsResponse-ListTicketsFromView`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { sort_by,sort_order, view_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/views/{view_id}/tickets'].get({
                                query: {sort_by,sort_order,},
                                params: {view_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ListTicketsFromView", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketsResponse`,
                                properties: TicketsResponseFields,
                            });
                        },
                })
                