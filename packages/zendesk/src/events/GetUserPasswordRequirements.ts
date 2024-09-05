
                    import { EventHandler } from '@arkw/core';
                    import { UserPasswordRequirementsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const GetUserPasswordRequirements: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-UserPasswordRequirementsResponse-GetUserPasswordRequirements`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  user_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/users/{user_id}/password/requirements'].get({
                                
                                params: {user_id,} })

                            if (!response.ok) {
                              console.log("error in fetching GetUserPasswordRequirements", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `UserPasswordRequirementsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `UserPasswordRequirementsResponse`,
                                properties: UserPasswordRequirementsResponseFields,
                            });
                        },
                })
                