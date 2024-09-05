
                    import { EventHandler } from '@arkw/core';
                    import { UserFieldResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowUserField: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-UserFieldResponse-ShowUserField`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  user_field_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/user_fields/{user_field_id}'].get({
                                
                                params: {user_field_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowUserField", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `UserFieldResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `UserFieldResponse`,
                                properties: UserFieldResponseFields,
                            });
                        },
                })
                