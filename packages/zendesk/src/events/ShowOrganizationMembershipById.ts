
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationMembershipResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowOrganizationMembershipById: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationMembershipResponse-ShowOrganizationMembershipById`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  organization_membership_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organization_memberships/{organization_membership_id}'].get({
                                
                                params: {organization_membership_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowOrganizationMembershipById", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationMembershipResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationMembershipResponse`,
                                properties: OrganizationMembershipResponseFields,
                            });
                        },
                })
                