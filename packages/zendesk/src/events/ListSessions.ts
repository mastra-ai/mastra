
                    import { EventHandler } from '@arkw/core';
                    import { SessionsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListSessions: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SessionsResponse-ListSessions`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/sessions'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListSessions", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SessionsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SessionsResponse`,
                                properties: SessionsResponseFields,
                            });
                        },
                })
                