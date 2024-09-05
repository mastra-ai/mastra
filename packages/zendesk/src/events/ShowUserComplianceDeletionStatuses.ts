
                    import { EventHandler } from '@arkw/core';
                    import { ComplianceDeletionStatusesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowUserComplianceDeletionStatuses: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ComplianceDeletionStatusesResponse-ShowUserComplianceDeletionStatuses`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { application, user_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/users/{user_id}/compliance_deletion_statuses'].get({
                                query: {application,},
                                params: {user_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowUserComplianceDeletionStatuses", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ComplianceDeletionStatusesResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ComplianceDeletionStatusesResponse`,
                                properties: ComplianceDeletionStatusesResponseFields,
                            });
                        },
                })
                