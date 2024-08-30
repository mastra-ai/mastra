
                    import { EventHandler } from '@arkw/core';
                    import { MacroAttachmentsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListMacroAttachments: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-MacroAttachmentsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  macro_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/macros/{macro_id}/attachments'].get({
                                
                                params: {macro_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `MacroAttachmentsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `MacroAttachmentsResponse`,
                                properties: MacroAttachmentsResponseFields,
                            });
                        },
                })
                