
                    import { EventHandler } from '@arkw/core';
                    import { CustomFieldOptionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTicketFieldOption: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomFieldOptionResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  ticket_field_id,ticket_field_option_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/ticket_fields/{ticket_field_id}/options/{ticket_field_option_id}'].get({
                                
                                params: {ticket_field_id,ticket_field_option_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomFieldOptionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomFieldOptionResponse`,
                                properties: CustomFieldOptionResponseFields,
                            });
                        },
                })
                