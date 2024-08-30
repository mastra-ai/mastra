
                    import { EventHandler } from '@arkw/core';
                    import { TicketAuditsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketAudits: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketAuditsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { limit,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/ticket_audits'].get({
                                query: {limit,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketAuditsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketAuditsResponse`,
                                properties: TicketAuditsResponseFields,
                            });
                        },
                })
                