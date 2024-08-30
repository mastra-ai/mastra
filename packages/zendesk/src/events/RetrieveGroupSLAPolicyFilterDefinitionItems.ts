
                    import { EventHandler } from '@arkw/core';
                    import { GroupSLAPolicyFilterDefinitionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const RetrieveGroupSLAPolicyFilterDefinitionItems: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupSLAPolicyFilterDefinitionResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/group_slas/policies/definitions'].get({
                                
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `GroupSLAPolicyFilterDefinitionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `GroupSLAPolicyFilterDefinitionResponse`,
                                properties: GroupSLAPolicyFilterDefinitionResponseFields,
                            });
                        },
                })
                