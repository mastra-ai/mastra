
                    import { EventHandler } from '@arkw/core';
                    import { OrganizationsRelatedResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const OrganizationRelated: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OrganizationsRelatedResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  organization_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/organizations/{organization_id}/related'].get({
                                
                                params: {organization_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OrganizationsRelatedResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OrganizationsRelatedResponse`,
                                properties: OrganizationsRelatedResponseFields,
                            });
                        },
                })
                