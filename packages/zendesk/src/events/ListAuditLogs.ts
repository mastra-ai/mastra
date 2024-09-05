
                    import { EventHandler } from '@arkw/core';
                    import { AuditLogsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAuditLogs: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-AuditLogsResponse-ListAuditLogs`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { filter[source_type],filter[source_id],filter[actor_id],filter[ip_address],filter[created_at],filter[action],sort_by,sort_order,sort,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/audit_logs'].get({
                                query: {filter[source_type],filter[source_id],filter[actor_id],filter[ip_address],filter[created_at],filter[action],sort_by,sort_order,sort,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListAuditLogs", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `AuditLogsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `AuditLogsResponse`,
                                properties: AuditLogsResponseFields,
                            });
                        },
                })
                