
                    import { EventHandler } from '@arkw/core';
                    import { TargetFailureResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTarFailure: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TargetFailureResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  target_failure_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/target_failures/{target_failure_id}'].get({
                                
                                params: {target_failure_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TargetFailureResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TargetFailureResponse`,
                                properties: TargetFailureResponseFields,
                            });
                        },
                })
                