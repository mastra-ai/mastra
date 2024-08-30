
                    import { EventHandler } from '@arkw/core';
                    import { ViewCountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const GetViewCount: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ViewCountResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  view_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/views/{view_id}/count'].get({
                                
                                params: {view_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ViewCountResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ViewCountResponse`,
                                properties: ViewCountResponseFields,
                            });
                        },
                })
                