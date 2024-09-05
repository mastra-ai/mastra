
                    import { EventHandler } from '@arkw/core';
                    import { TwitterChannelTwicketStatusResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const GettingTwicketStatus: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TwitterChannelTwicketStatusResponse-GettingTwicketStatus`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { ids, comment_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/channels/twitter/tickets/{comment_id}/statuses'].get({
                                query: {ids,},
                                params: {comment_id,} })

                            if (!response.ok) {
                              console.log("error in fetching GettingTwicketStatus", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TwitterChannelTwicketStatusResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TwitterChannelTwicketStatusResponse`,
                                properties: TwitterChannelTwicketStatusResponseFields,
                            });
                        },
                })
                