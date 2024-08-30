
                    import { EventHandler } from '@arkw/core';
                    import { ResourceCollectionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const RetrieveResourceCollection: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ResourceCollectionResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  resource_collection_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/resource_collections/{resource_collection_id}'].get({
                                
                                params: {resource_collection_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                