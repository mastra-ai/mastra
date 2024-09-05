
                    import { EventHandler } from '@arkw/core';
                    import { TicketRelatedInformationFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const TicketRelatedInformation: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketRelatedInformation-TicketRelatedInformation`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { TicketId, ticket_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/tickets/{ticket_id}/related'].get({
                                query: {TicketId,},
                                params: {ticket_id,} })

                            if (!response.ok) {
                              console.log("error in fetching TicketRelatedInformation", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketRelatedInformation`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketRelatedInformation`,
                                properties: TicketRelatedInformationFields,
                            });
                        },
                })
                