
                    import { EventHandler } from '@arkw/core';
                    import { ViewsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListViews: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ViewsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { access,active,group_id,sort_by,sort_order,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/views'].get({
                                query: {access,active,group_id,sort_by,sort_order,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ViewsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ViewsResponse`,
                                properties: ViewsResponseFields,
                            });
                        },
                })
                