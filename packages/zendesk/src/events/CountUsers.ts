
                    import { EventHandler } from '@arkw/core';
                    import { CountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountUsers: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CountResponse-CountUsers`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { UserRoleFilter,UserRolesFilter,UserPermissionSetFilter,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/users/count'].get({
                                query: {UserRoleFilter,UserRolesFilter,UserPermissionSetFilter,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching CountUsers", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CountResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CountResponse`,
                                properties: CountResponseFields,
                            });
                        },
                })
                