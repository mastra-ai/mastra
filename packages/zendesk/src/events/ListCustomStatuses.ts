
                    import { EventHandler } from '@arkw/core';
                    import { CustomStatusesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListCustomStatuses: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomStatusesResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { status_categories,active,default,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/custom_statuses'].get({
                                query: {status_categories,active,default,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomStatusesResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomStatusesResponse`,
                                properties: CustomStatusesResponseFields,
                            });
                        },
                })
                