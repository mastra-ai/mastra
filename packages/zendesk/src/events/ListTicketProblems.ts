
                    import { EventHandler } from '@arkw/core';
                    import { ListTicketProblemsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketProblems: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ListTicketProblemsResponse-ListTicketProblems`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/problems'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListTicketProblems", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ListTicketProblemsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ListTicketProblemsResponse`,
                                properties: ListTicketProblemsResponseFields,
                            });
                        },
                })
                