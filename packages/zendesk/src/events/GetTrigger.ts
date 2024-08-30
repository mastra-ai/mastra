
                    import { EventHandler } from '@arkw/core';
                    import { TriggerResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const GetTrigger: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TriggerResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  trigger_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/triggers/{trigger_id}'].get({
                                
                                params: {trigger_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TriggerResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TriggerResponse`,
                                properties: TriggerResponseFields,
                            });
                        },
                })
                