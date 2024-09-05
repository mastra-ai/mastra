
                    import { EventHandler } from '@arkw/core';
                    import { CountOrganizationResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountOrganizations: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CountOrganizationResponse-CountOrganizations`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organizations/count'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching CountOrganizations", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CountOrganizationResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CountOrganizationResponse`,
                                properties: CountOrganizationResponseFields,
                            });
                        },
                })
                