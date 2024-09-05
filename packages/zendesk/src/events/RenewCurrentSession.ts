
                    import { EventHandler } from '@arkw/core';
                    import { RenewSessionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const RenewCurrentSession: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-RenewSessionResponse-RenewCurrentSession`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/users/me/session/renew'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching RenewCurrentSession", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `RenewSessionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `RenewSessionResponse`,
                                properties: RenewSessionResponseFields,
                            });
                        },
                })
                