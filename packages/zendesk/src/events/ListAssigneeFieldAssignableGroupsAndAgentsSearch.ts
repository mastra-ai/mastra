
                    import { EventHandler } from '@arkw/core';
                    import { AssigneeFieldAssignableGroupsAndAgentsSearchResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAssigneeFieldAssignableGroupsAndAgentsSearch: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-AssigneeFieldAssignableGroupsAndAgentsSearchResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { AssigneeFieldSearchValue,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/lotus/assignables/autocomplete.json'].get({
                                query: {AssigneeFieldSearchValue,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `AssigneeFieldAssignableGroupsAndAgentsSearchResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `AssigneeFieldAssignableGroupsAndAgentsSearchResponse`,
                                properties: AssigneeFieldAssignableGroupsAndAgentsSearchResponseFields,
                            });
                        },
                })
                