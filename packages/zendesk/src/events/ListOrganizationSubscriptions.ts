
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationSubscriptionsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListOrganizationSubscriptions: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationSubscriptionsResponse-ListOrganizationSubscriptions`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organization_subscriptions'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListOrganizationSubscriptions", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationSubscriptionsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationSubscriptionsResponse`,
                                properties: OrganizationSubscriptionsResponseFields,
                            });
                        },
                })
                