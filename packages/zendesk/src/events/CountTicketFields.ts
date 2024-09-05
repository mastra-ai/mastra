
                    import { EventHandler } from '@arkw/core';
                    import { TicketFieldCountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountTicketFields: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketFieldCountResponse-CountTicketFields`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/ticket_fields/count'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching CountTicketFields", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketFieldCountResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketFieldCountResponse`,
                                properties: TicketFieldCountResponseFields,
                            });
                        },
                })
                