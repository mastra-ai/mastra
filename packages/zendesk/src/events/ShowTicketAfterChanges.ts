
                    import { EventHandler } from '@arkw/core';
                    import { MacroApplyTicketResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTicketAfterChanges: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-MacroApplyTicketResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  ticket_id,macro_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/tickets/{ticket_id}/macros/{macro_id}/apply'].get({
                                
                                params: {ticket_id,macro_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `MacroApplyTicketResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `MacroApplyTicketResponse`,
                                properties: MacroApplyTicketResponseFields,
                            });
                        },
                })
                