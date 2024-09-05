
                    import { EventHandler } from '@arkw/core';
                    import { CustomStatusResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowCustomStatus: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomStatusResponse-ShowCustomStatus`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { CustomStatusId, custom_status_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/custom_statuses/{custom_status_id}'].get({
                                query: {CustomStatusId,},
                                params: {custom_status_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowCustomStatus", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
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
                