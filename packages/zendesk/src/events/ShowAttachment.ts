
                    import { EventHandler } from '@arkw/core';
                    import { AttachmentResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowAttachment: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-AttachmentResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { AttachmentId, attachment_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/attachments/{attachment_id}'].get({
                                query: {AttachmentId,},
                                params: {attachment_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `AttachmentResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `AttachmentResponse`,
                                properties: AttachmentResponseFields,
                            });
                        },
                })
                