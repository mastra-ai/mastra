
                    import { EventHandler } from '@arkw/core';
                    import { TicketAuditsCountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountAuditsForTicket: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketAuditsCountResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  ticket_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/tickets/{ticket_id}/audits/count'].get({
                                
                                params: {ticket_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketAuditsCountResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketAuditsCountResponse`,
                                properties: TicketAuditsCountResponseFields,
                            });
                        },
                })
                