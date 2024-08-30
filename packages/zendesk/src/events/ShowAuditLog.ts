
                    import { EventHandler } from '@arkw/core';
                    import { AuditLogResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowAuditLog: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-AuditLogResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  audit_log_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/audit_logs/{audit_log_id}'].get({
                                
                                params: {audit_log_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `AuditLogResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `AuditLogResponse`,
                                properties: AuditLogResponseFields,
                            });
                        },
                })
                