
                    import { EventHandler } from '@arkw/core';
                    import { LocalesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAvailablePublicLocales: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-LocalesResponse-ListAvailablePublicLocales`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/locales/public'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListAvailablePublicLocales", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `LocalesResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `LocalesResponse`,
                                properties: LocalesResponseFields,
                            });
                        },
                })
                