
                    import { EventHandler } from '@arkw/core';
                    import { SLAPolicyResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowSLAPolicy: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SLAPolicyResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  sla_policy_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/slas/policies/{sla_policy_id}'].get({
                                
                                params: {sla_policy_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SLAPolicyResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SLAPolicyResponse`,
                                properties: SLAPolicyResponseFields,
                            });
                        },
                })
                