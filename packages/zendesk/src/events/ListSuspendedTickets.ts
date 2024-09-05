
                    import { EventHandler } from '@arkw/core';
                    import { SuspendedTicketsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListSuspendedTickets: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SuspendedTicketsResponse-ListSuspendedTickets`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/suspended_tickets'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListSuspendedTickets", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SuspendedTicketsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SuspendedTicketsResponse`,
                                properties: SuspendedTicketsResponseFields,
                            });
                        },
                })
                