
                    import { EventHandler } from '@arkw/core';
                    import { TicketCommentsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketComments: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketCommentsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { include_inline_images,include, ticket_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/tickets/{ticket_id}/comments'].get({
                                query: {include_inline_images,include,},
                                params: {ticket_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketCommentsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketCommentsResponse`,
                                properties: TicketCommentsResponseFields,
                            });
                        },
                })
                