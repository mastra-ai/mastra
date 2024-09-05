
                    import { EventHandler } from '@arkw/core';
                    import { TicketResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTicket: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketResponse-ShowTicket`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { TicketId, ticket_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/tickets/{ticket_id}'].get({
                                query: {TicketId,},
                                params: {ticket_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowTicket", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketResponse`,
                                properties: TicketResponseFields,
                            });
                        },
                })
                