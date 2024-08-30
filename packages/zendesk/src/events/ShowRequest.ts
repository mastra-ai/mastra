
                    import { EventHandler } from '@arkw/core';
                    import { RequestResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowRequest: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-RequestResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  request_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/requests/{request_id}'].get({
                                
                                params: {request_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `RequestResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `RequestResponse`,
                                properties: RequestResponseFields,
                            });
                        },
                })
                