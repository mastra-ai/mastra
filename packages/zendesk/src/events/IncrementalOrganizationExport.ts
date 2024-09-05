
                    import { EventHandler } from '@arkw/core';
                    import { ExportIncrementalOrganizationsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const IncrementalOrganizationExport: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ExportIncrementalOrganizationsResponse-IncrementalOrganizationExport`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/incremental/organizations'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching IncrementalOrganizationExport", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ExportIncrementalOrganizationsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ExportIncrementalOrganizationsResponse`,
                                properties: ExportIncrementalOrganizationsResponseFields,
                            });
                        },
                })
                