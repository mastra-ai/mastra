
                    import { EventHandler } from '@arkw/core';
                    import { ResourceCollectionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const RetrieveResourceCollection: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ResourceCollectionResponse-RetrieveResourceCollection`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  resource_collection_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/resource_collections/{resource_collection_id}'].get({
                                
                                params: {resource_collection_id,} })

                            if (!response.ok) {
                              console.log("error in fetching RetrieveResourceCollection", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ResourceCollectionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ResourceCollectionResponse`,
                                properties: ResourceCollectionResponseFields,
                            });
                        },
                })
                