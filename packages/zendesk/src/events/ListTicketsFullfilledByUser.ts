
                    import { EventHandler } from '@arkw/core';
                    import { SkillBasedRoutingTicketFulfilledResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketsFullfilledByUser: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SkillBasedRoutingTicketFulfilledResponse-ListTicketsFullfilledByUser`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { ticket_ids,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/routing/requirements/fulfilled'].get({
                                query: {ticket_ids,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListTicketsFullfilledByUser", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SkillBasedRoutingTicketFulfilledResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SkillBasedRoutingTicketFulfilledResponse`,
                                properties: SkillBasedRoutingTicketFulfilledResponseFields,
                            });
                        },
                })
                