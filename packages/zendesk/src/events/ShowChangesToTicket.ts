
                    import { EventHandler } from '@arkw/core';
                    import { MacroApplyTicketResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowChangesToTicket: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-MacroApplyTicketResponse-ShowChangesToTicket`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  macro_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/macros/{macro_id}/apply'].get({
                                
                                params: {macro_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowChangesToTicket", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
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
                