
                    import { EventHandler } from '@arkw/core';
                    import { SessionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowSession: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SessionResponse-ShowSession`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  user_id,session_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/users/{user_id}/sessions/{session_id}'].get({
                                
                                params: {user_id,session_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowSession", {response});
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
                