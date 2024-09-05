
                    import { EventHandler } from '@arkw/core';
                    import { TagsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTags: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TagsResponse-ListTags`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/tags'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListTags", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TagsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TagsResponse`,
                                properties: TagsResponseFields,
                            });
                        },
                })
                