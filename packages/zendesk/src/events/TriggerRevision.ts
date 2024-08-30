
                    import { EventHandler } from '@arkw/core';
                    import { TriggerRevisionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const TriggerRevision: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TriggerRevisionResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  trigger_id,trigger_revision_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/triggers/{trigger_id}/revisions/{trigger_revision_id}'].get({
                                
                                params: {trigger_id,trigger_revision_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TriggerRevisionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TriggerRevisionResponse`,
                                properties: TriggerRevisionResponseFields,
                            });
                        },
                })
                