
                    import { EventHandler } from '@arkw/core';
                    import { LocaleResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const DetectBestLocale: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-LocaleResponse-DetectBestLocale`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/locales/detect_best_locale'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching DetectBestLocale", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
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
                