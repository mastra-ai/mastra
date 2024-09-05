
                    import { EventHandler } from '@arkw/core';
                    import { SharingAgreementsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListSharingAgreements: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SharingAgreementsResponse-ListSharingAgreements`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/sharing_agreements'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListSharingAgreements", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SharingAgreementsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SharingAgreementsResponse`,
                                properties: SharingAgreementsResponseFields,
                            });
                        },
                })
                