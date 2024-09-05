
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationFieldResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowOrganizationField: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationFieldResponse-ShowOrganizationField`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  organization_field_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organization_fields/{organization_field_id}'].get({
                                
                                params: {organization_field_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowOrganizationField", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationFieldResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationFieldResponse`,
                                properties: OrganizationFieldResponseFields,
                            });
                        },
                })
                