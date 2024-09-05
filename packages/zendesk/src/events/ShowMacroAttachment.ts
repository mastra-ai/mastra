
                    import { EventHandler } from '@arkw/core';
                    import { MacroAttachmentResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowMacroAttachment: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-MacroAttachmentResponse-ShowMacroAttachment`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  attachment_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/macros/attachments/{attachment_id}'].get({
                                
                                params: {attachment_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowMacroAttachment", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `MacroAttachmentResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `MacroAttachmentResponse`,
                                properties: MacroAttachmentResponseFields,
                            });
                        },
                })
                