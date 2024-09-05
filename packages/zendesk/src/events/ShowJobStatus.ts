
                    import { EventHandler } from '@arkw/core';
                    import { JobStatusResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowJobStatus: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-JobStatusResponse-ShowJobStatus`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  job_status_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/job_statuses/{job_status_id}'].get({
                                
                                params: {job_status_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowJobStatus", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `JobStatusResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `JobStatusResponse`,
                                properties: JobStatusResponseFields,
                            });
                        },
                })
                