
                    import { EventHandler } from '@arkw/core';
                    import { TicketFormResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTicketForm: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketFormResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  ticket_form_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/ticket_forms/{ticket_form_id}'].get({
                                
                                params: {ticket_form_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketFormResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketFormResponse`,
                                properties: TicketFormResponseFields,
                            });
                        },
                })
                