
                    import { EventHandler } from '@arkw/core';
                    import { EmailNotificationResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowEmailNotification: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-EmailNotificationResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  notification_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/email_notifications/{notification_id}'].get({
                                
                                params: {notification_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `EmailNotificationResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `EmailNotificationResponse`,
                                properties: EmailNotificationResponseFields,
                            });
                        },
                })
                