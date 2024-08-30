
                    import { EventHandler } from '@arkw/core';
                    import { TriggerRevisionsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTriggerRevisions: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TriggerRevisionsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  trigger_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/triggers/{trigger_id}/revisions'].get({
                                
                                params: {trigger_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TriggerRevisionsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TriggerRevisionsResponse`,
                                properties: TriggerRevisionsResponseFields,
                            });
                        },
                })
                