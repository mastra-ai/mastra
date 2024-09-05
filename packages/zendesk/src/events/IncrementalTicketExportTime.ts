
                    import { EventHandler } from '@arkw/core';
                    import { TimeBasedExportIncrementalTicketsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const IncrementalTicketExportTime: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TimeBasedExportIncrementalTicketsResponse-IncrementalTicketExportTime`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/incremental/tickets'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching IncrementalTicketExportTime", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TimeBasedExportIncrementalTicketsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TimeBasedExportIncrementalTicketsResponse`,
                                properties: TimeBasedExportIncrementalTicketsResponseFields,
                            });
                        },
                })
                