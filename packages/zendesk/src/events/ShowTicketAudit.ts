
                    import { EventHandler } from '@arkw/core';
                    import { TicketAuditResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTicketAudit: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketAuditResponse-ShowTicketAudit`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  ticket_id,ticket_audit_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/tickets/{ticket_id}/audits/{ticket_audit_id}'].get({
                                
                                params: {ticket_id,ticket_audit_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowTicketAudit", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketAuditResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketAuditResponse`,
                                properties: TicketAuditResponseFields,
                            });
                        },
                })
                