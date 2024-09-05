
                    import { EventHandler } from '@arkw/core';
                    import { TicketAuditsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketAudits: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketAuditsResponse-ListTicketAudits`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { limit,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/ticket_audits'].get({
                                query: {limit,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListTicketAudits", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
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
                