
                    import { EventHandler } from '@arkw/core';
                    import { GroupSLAPolicyResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowGroupSLAPolicy: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupSLAPolicyResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  group_sla_policy_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/group_slas/policies/{group_sla_policy_id}'].get({
                                
                                params: {group_sla_policy_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `GroupSLAPolicyResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `GroupSLAPolicyResponse`,
                                properties: GroupSLAPolicyResponseFields,
                            });
                        },
                })
                