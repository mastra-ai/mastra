
                    import { EventHandler } from '@arkw/core';
                    import { CustomRolesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListCustomRoles: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomRolesResponse-ListCustomRoles`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/custom_roles'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListCustomRoles", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomRolesResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomRolesResponse`,
                                properties: CustomRolesResponseFields,
                            });
                        },
                })
                