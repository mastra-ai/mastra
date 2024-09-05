
                    import { EventHandler } from '@arkw/core';
                    import { TicketCommentResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowComment: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketCommentResponse-ShowComment`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  request_id,ticket_comment_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/requests/{request_id}/comments/{ticket_comment_id}'].get({
                                
                                params: {request_id,ticket_comment_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowComment", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketCommentResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketCommentResponse`,
                                properties: TicketCommentResponseFields,
                            });
                        },
                })
                