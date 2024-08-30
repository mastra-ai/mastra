
                    import { EventHandler } from '@arkw/core';
                    import { GroupResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowGroupById: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  group_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/groups/{group_id}'].get({
                                
                                params: {group_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                