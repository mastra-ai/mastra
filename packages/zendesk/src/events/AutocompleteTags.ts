
                    import { EventHandler } from '@arkw/core';
                    import { TagsByObjectIdResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const AutocompleteTags: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TagsByObjectIdResponse-AutocompleteTags`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/autocomplete/tags'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching AutocompleteTags", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TagsByObjectIdResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TagsByObjectIdResponse`,
                                properties: TagsByObjectIdResponseFields,
                            });
                        },
                })
                