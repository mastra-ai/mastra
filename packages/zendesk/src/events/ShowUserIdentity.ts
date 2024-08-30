
                    import { EventHandler } from '@arkw/core';
                    import { UserIdentityResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowUserIdentity: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-UserIdentityResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  user_id,user_identity_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/users/{user_id}/identities/{user_identity_id}'].get({
                                
                                params: {user_id,user_identity_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `UserIdentityResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `UserIdentityResponse`,
                                properties: UserIdentityResponseFields,
                            });
                        },
                })
                