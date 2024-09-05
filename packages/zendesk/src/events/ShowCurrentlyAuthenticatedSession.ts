
                    import { EventHandler } from '@arkw/core';
                    import { SessionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowCurrentlyAuthenticatedSession: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SessionResponse-ShowCurrentlyAuthenticatedSession`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/users/me/session'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ShowCurrentlyAuthenticatedSession", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SessionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SessionResponse`,
                                properties: SessionResponseFields,
                            });
                        },
                })
                