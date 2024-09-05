
                    import { EventHandler } from '@arkw/core';
                    import { ListTicketFollowersResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketFollowers: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ListTicketFollowersResponse-ListTicketFollowers`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { TicketId, ticket_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/tickets/{ticket_id}/followers'].get({
                                query: {TicketId,},
                                params: {ticket_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ListTicketFollowers", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ListTicketFollowersResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ListTicketFollowersResponse`,
                                properties: ListTicketFollowersResponseFields,
                            });
                        },
                })
                