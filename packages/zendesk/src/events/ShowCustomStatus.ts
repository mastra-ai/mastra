
                    import { EventHandler } from '@arkw/core';
                    import { CustomStatusResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowCustomStatus: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomStatusResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { CustomStatusId, custom_status_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/custom_statuses/{custom_status_id}'].get({
                                query: {CustomStatusId,},
                                params: {custom_status_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomStatusResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomStatusResponse`,
                                properties: CustomStatusResponseFields,
                            });
                        },
                })
                