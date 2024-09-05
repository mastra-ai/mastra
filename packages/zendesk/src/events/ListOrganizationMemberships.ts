
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationMembershipsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListOrganizationMemberships: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationMembershipsResponse-ListOrganizationMemberships`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organization_memberships'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListOrganizationMemberships", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationMembershipsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationMembershipsResponse`,
                                properties: OrganizationMembershipsResponseFields,
                            });
                        },
                })
                