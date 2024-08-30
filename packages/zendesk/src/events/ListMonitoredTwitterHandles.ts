
                    import { EventHandler } from '@arkw/core';
                    import { TwitterChannelsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListMonitoredTwitterHandles: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TwitterChannelsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/channels/twitter/monitored_twitter_handles'].get({
                                
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TwitterChannelsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TwitterChannelsResponse`,
                                properties: TwitterChannelsResponseFields,
                            });
                        },
                })
                