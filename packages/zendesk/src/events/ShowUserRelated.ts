
                    import { EventHandler } from '@arkw/core';
                    import { UserRelatedResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowUserRelated: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-UserRelatedResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  user_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/users/{user_id}/related'].get({
                                
                                params: {user_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `UserRelatedResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `UserRelatedResponse`,
                                properties: UserRelatedResponseFields,
                            });
                        },
                })
                