
                    import { EventHandler } from '@arkw/core';
                    import { TicketSkipsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketSkips: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketSkipsResponse-ListTicketSkips`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  user_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/users/{user_id}/skips'].get({
                                
                                params: {user_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ListTicketSkips", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketSkipsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketSkipsResponse`,
                                properties: TicketSkipsResponseFields,
                            });
                        },
                })
                