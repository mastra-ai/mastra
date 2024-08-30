
                    import { EventHandler } from '@arkw/core';
                    import { TicketFieldsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketFields: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketFieldsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { locale,creator,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/ticket_fields'].get({
                                query: {locale,creator,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketFieldsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketFieldsResponse`,
                                properties: TicketFieldsResponseFields,
                            });
                        },
                })
                