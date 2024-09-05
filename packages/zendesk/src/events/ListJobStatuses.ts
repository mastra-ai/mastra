
                    import { EventHandler } from '@arkw/core';
                    import { JobStatusesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListJobStatuses: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-JobStatusesResponse-ListJobStatuses`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/job_statuses'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListJobStatuses", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `JobStatusesResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `JobStatusesResponse`,
                                properties: JobStatusesResponseFields,
                            });
                        },
                })
                