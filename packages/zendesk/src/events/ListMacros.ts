
                    import { EventHandler } from '@arkw/core';
                    import { MacrosResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListMacros: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-MacrosResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { MacroInclude,MacroAccess,MacroActive,MacroCategory,MacroGroupId,MacroOnlyViewable,MacroSortBy,MacroSortOrder,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/macros'].get({
                                query: {MacroInclude,MacroAccess,MacroActive,MacroCategory,MacroGroupId,MacroOnlyViewable,MacroSortBy,MacroSortOrder,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `MacrosResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `MacrosResponse`,
                                properties: MacrosResponseFields,
                            });
                        },
                })
                