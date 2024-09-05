
                    import { EventHandler } from '@arkw/core';
                    import { UsersResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const AutocompleteUsers: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-UsersResponse-AutocompleteUsers`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { name,LookupRelationshipAutocompleteFieldIdFragment,LookupRelationshipAutocompleteSourceFragment,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/users/autocomplete'].get({
                                query: {name,LookupRelationshipAutocompleteFieldIdFragment,LookupRelationshipAutocompleteSourceFragment,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching AutocompleteUsers", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `UsersResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `UsersResponse`,
                                properties: UsersResponseFields,
                            });
                        },
                })
                