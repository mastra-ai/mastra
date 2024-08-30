
                    import { EventHandler } from '@arkw/core';
                    import { AutomationResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowAutomation: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-AutomationResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  automation_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/automations/{automation_id}'].get({
                                
                                params: {automation_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `AutomationResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `AutomationResponse`,
                                properties: AutomationResponseFields,
                            });
                        },
                })
                