
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowOrganization: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationResponse-ShowOrganization`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  organization_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organizations/{organization_id}'].get({
                                
                                params: {organization_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowOrganization", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationResponse`,
                                properties: OrganizationResponseFields,
                            });
                        },
                })
                