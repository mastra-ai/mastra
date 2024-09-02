
                    import { EventHandler } from '@arkw/core';
                    import { WebhookResponseFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const Webhooks: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-WebhookResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { limit,offset,workspace,resource,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/webhooks'].get({
                                query: {limit,offset,workspace,resource,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `WebhookResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `WebhookResponse`,
                                properties: WebhookResponseFields,
                            });
                        },
                })
                