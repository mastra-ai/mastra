
                    import { EventHandler } from '@arkw/core';
                    import { CountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountUsers: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CountResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { UserRoleFilter,UserRolesFilter,UserPermissionSetFilter,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/users/count'].get({
                                query: {UserRoleFilter,UserRolesFilter,UserPermissionSetFilter,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                