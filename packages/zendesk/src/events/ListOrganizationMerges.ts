
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationMergeListResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListOrganizationMerges: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationMergeListResponse-ListOrganizationMerges`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  organization_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organizations/{organization_id}/merges'].get({
                                
                                params: {organization_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ListOrganizationMerges", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationMergeListResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationMergeListResponse`,
                                properties: OrganizationMergeListResponseFields,
                            });
                        },
                })
                