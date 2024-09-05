
                    import { EventHandler } from '@arkw/core';
                    import { TagCountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountTags: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TagCountResponse-CountTags`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/tags/count'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching CountTags", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TagCountResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TagCountResponse`,
                                properties: TagCountResponseFields,
                            });
                        },
                })
                