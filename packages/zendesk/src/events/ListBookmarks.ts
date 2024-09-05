
                    import { EventHandler } from '@arkw/core';
                    import { BookmarksResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListBookmarks: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-BookmarksResponse-ListBookmarks`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/bookmarks'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListBookmarks", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `BookmarksResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `BookmarksResponse`,
                                properties: BookmarksResponseFields,
                            });
                        },
                })
                