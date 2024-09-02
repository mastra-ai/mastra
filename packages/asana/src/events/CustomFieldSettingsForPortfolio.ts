
                    import { EventHandler } from '@arkw/core';
                    import { CustomFieldSettingResponseFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const CustomFieldSettingsForPortfolio: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomFieldSettingResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  portfolio_gid,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/portfolios/{portfolio_gid}/custom_field_settings'].get({
                                
                                params: {portfolio_gid,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomFieldSettingResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomFieldSettingResponse`,
                                properties: CustomFieldSettingResponseFields,
                            });
                        },
                })
                