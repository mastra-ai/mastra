
                    import { EventHandler } from '@arkw/core';
                    import { LocaleResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowLocaleById: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-LocaleResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  locale_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/locales/{locale_id}'].get({
                                
                                params: {locale_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `LocaleResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `LocaleResponse`,
                                properties: LocaleResponseFields,
                            });
                        },
                })
                