
                    import { EventHandler } from '@arkw/core';
                    import { TicketsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketsFromView: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { sort_by,sort_order, view_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/views/{view_id}/tickets'].get({
                                query: {sort_by,sort_order,},
                                params: {view_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketsResponse`,
                                properties: TicketsResponseFields,
                            });
                        },
                })
                