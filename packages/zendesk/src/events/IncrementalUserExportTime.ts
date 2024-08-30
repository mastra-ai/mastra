
                    import { EventHandler } from '@arkw/core';
                    import { TimeBasedExportIncrementalUsersResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const IncrementalUserExportTime: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TimeBasedExportIncrementalUsersResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/incremental/users'].get({
                                
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TimeBasedExportIncrementalUsersResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TimeBasedExportIncrementalUsersResponse`,
                                properties: TimeBasedExportIncrementalUsersResponseFields,
                            });
                        },
                })
                