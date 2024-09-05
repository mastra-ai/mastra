
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationMergeResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowOrganizationMerge: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationMergeResponse-ShowOrganizationMerge`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  organization_merge_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organization_merges/{organization_merge_id}'].get({
                                
                                params: {organization_merge_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowOrganizationMerge", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationMergeResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationMergeResponse`,
                                properties: OrganizationMergeResponseFields,
                            });
                        },
                })
                