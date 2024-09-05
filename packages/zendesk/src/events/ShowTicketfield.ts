
                    import { EventHandler } from '@arkw/core';
                    import { TicketFieldResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTicketfield: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketFieldResponse-ShowTicketfield`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  ticket_field_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/ticket_fields/{ticket_field_id}'].get({
                                
                                params: {ticket_field_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowTicketfield", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketFieldResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketFieldResponse`,
                                properties: TicketFieldResponseFields,
                            });
                        },
                })
                