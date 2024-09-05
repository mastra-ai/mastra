
                    import { EventHandler } from '@arkw/core';
                    import { TwitterChannelResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowMonitoredTwitterHandle: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TwitterChannelResponse-ShowMonitoredTwitterHandle`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  monitored_twitter_handle_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/channels/twitter/monitored_twitter_handles/{monitored_twitter_handle_id}'].get({
                                
                                params: {monitored_twitter_handle_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowMonitoredTwitterHandle", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TwitterChannelResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TwitterChannelResponse`,
                                properties: TwitterChannelResponseFields,
                            });
                        },
                })
                