
                    import { EventHandler } from '@arkw/core';
                    import { CustomFieldOptionsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketFieldOptions: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomFieldOptionsResponse-ListTicketFieldOptions`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  ticket_field_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/ticket_fields/{ticket_field_id}/options'].get({
                                
                                params: {ticket_field_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ListTicketFieldOptions", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomFieldOptionsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomFieldOptionsResponse`,
                                properties: CustomFieldOptionsResponseFields,
                            });
                        },
                })
                