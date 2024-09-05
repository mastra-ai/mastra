
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationFieldsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListOrganizationFields: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationFieldsResponse-ListOrganizationFields`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organization_fields'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListOrganizationFields", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationFieldsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationFieldsResponse`,
                                properties: OrganizationFieldsResponseFields,
                            });
                        },
                })
                