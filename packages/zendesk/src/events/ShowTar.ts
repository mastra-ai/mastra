
                    import { EventHandler } from '@arkw/core';
                    import { TargetResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTar: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TargetResponse-ShowTar`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  target_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/targets/{target_id}'].get({
                                
                                params: {target_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowTar", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TargetResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TargetResponse`,
                                properties: TargetResponseFields,
                            });
                        },
                })
                