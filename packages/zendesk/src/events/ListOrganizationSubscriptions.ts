
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationSubscriptionsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListOrganizationSubscriptions: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationSubscriptionsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/organization_subscriptions'].get({
                                
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                