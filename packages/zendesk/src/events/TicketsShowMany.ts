
                    import { EventHandler } from '@arkw/core';
                    import { TicketsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const TicketsShowMany: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketsResponse-TicketsShowMany`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { TicketIds,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/tickets/show_many'].get({
                                query: {TicketIds,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching TicketsShowMany", {response});
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
                