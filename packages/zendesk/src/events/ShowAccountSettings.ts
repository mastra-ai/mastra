
                    import { EventHandler } from '@arkw/core';
                    import { AccountSettingsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowAccountSettings: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-AccountSettingsResponse-ShowAccountSettings`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/account/settings'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ShowAccountSettings", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `AccountSettingsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `AccountSettingsResponse`,
                                properties: AccountSettingsResponseFields,
                            });
                        },
                })
                