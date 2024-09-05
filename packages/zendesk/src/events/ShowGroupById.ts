
                    import { EventHandler } from '@arkw/core';
                    import { GroupResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowGroupById: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupResponse-ShowGroupById`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  group_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/groups/{group_id}'].get({
                                
                                params: {group_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowGroupById", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `GroupResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `GroupResponse`,
                                properties: GroupResponseFields,
                            });
                        },
                })
                