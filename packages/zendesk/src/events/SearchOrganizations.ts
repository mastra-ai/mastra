
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const SearchOrganizations: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationsResponse-SearchOrganizations`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organizations/search'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching SearchOrganizations", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationsResponse`,
                                properties: OrganizationsResponseFields,
                            });
                        },
                })
                