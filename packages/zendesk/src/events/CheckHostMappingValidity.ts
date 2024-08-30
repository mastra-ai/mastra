
                    import { EventHandler } from '@arkw/core';
                    import { HostMappingObjectFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CheckHostMappingValidity: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-HostMappingObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { HostMapping,Subdomain,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/brands/check_host_mapping'].get({
                                query: {HostMapping,Subdomain,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `HostMappingObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `HostMappingObject`,
                                properties: HostMappingObjectFields,
                            });
                        },
                })
                