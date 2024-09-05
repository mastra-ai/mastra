
                    import { EventHandler } from '@arkw/core';
                    import { CursorBasedExportIncrementalUsersResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const IncrementalUserExportCursor: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CursorBasedExportIncrementalUsersResponse-IncrementalUserExportCursor`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/incremental/users/cursor'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching IncrementalUserExportCursor", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CursorBasedExportIncrementalUsersResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CursorBasedExportIncrementalUsersResponse`,
                                properties: CursorBasedExportIncrementalUsersResponseFields,
                            });
                        },
                })
                