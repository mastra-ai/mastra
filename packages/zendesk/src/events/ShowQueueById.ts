
                    import { EventHandler } from '@arkw/core';
                    import { QueueResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowQueueById: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-QueueResponse-ShowQueueById`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  queue_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/queues/{queue_id}'].get({
                                
                                params: {queue_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowQueueById", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `QueueResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `QueueResponse`,
                                properties: QueueResponseFields,
                            });
                        },
                })
                