
                    import { EventHandler } from '@arkw/core';
                    import { TargetFailuresResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTarFailures: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TargetFailuresResponse-ListTarFailures`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/target_failures'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListTarFailures", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TargetFailuresResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TargetFailuresResponse`,
                                properties: TargetFailuresResponseFields,
                            });
                        },
                })
                