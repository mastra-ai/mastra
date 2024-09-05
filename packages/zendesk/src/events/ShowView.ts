
                    import { EventHandler } from '@arkw/core';
                    import { ViewResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowView: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ViewResponse-ShowView`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  view_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/views/{view_id}'].get({
                                
                                params: {view_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowView", {response});
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
                