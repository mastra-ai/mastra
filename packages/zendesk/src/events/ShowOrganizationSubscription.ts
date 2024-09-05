
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationSubscriptionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowOrganizationSubscription: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationSubscriptionResponse-ShowOrganizationSubscription`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { OrganizationSubscriptionId, organization_subscription_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/organization_subscriptions/{organization_subscription_id}'].get({
                                query: {OrganizationSubscriptionId,},
                                params: {organization_subscription_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowOrganizationSubscription", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationSubscriptionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationSubscriptionResponse`,
                                properties: OrganizationSubscriptionResponseFields,
                            });
                        },
                })
                