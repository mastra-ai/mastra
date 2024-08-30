
                    import { EventHandler } from '@arkw/core';
                    import { CustomRoleResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowCustomRoleById: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomRoleResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  custom_role_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/custom_roles/{custom_role_id}'].get({
                                
                                params: {custom_role_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomRoleResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomRoleResponse`,
                                properties: CustomRoleResponseFields,
                            });
                        },
                })
                