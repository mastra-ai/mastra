
                    import { EventHandler } from '@arkw/core';
                    import { ViewResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ExecuteView: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ViewResponse-ExecuteView`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { sort_by,sort_order, view_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/views/{view_id}/execute'].get({
                                query: {sort_by,sort_order,},
                                params: {view_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ExecuteView", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ViewResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ViewResponse`,
                                properties: ViewResponseFields,
                            });
                        },
                })
                