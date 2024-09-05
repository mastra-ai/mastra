
                    import { EventHandler } from '@arkw/core';
                    import { TicketFormsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketForms: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketFormsResponse-ListTicketForms`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { active,end_user_visible,fallback_to_default,associated_to_brand,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/ticket_forms'].get({
                                query: {active,end_user_visible,fallback_to_default,associated_to_brand,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListTicketForms", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketFormsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketFormsResponse`,
                                properties: TicketFormsResponseFields,
                            });
                        },
                })
                