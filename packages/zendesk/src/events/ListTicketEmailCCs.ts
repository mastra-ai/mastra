
                    import { EventHandler } from '@arkw/core';
                    import { ListTicketEmailCCsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketEmailCCs: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ListTicketEmailCCsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { TicketId, ticket_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/tickets/{ticket_id}/email_ccs'].get({
                                query: {TicketId,},
                                params: {ticket_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ListTicketEmailCCsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ListTicketEmailCCsResponse`,
                                properties: ListTicketEmailCCsResponseFields,
                            });
                        },
                })
                