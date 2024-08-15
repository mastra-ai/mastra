import { DataLayer, EventHandler } from 'core';

import { createGoogleMailFields } from '../helpers';

export const emailSync = ({
  name,
  event,
  dataLayer,
}: {
  event: string;
  dataLayer: DataLayer;
  name: string;
}): EventHandler => ({
  id: `${name}-sync-email`,
  event,
  executor: async ({ event, step }) => {
    const { contacts, emails } = event.data;
    const { connectionId } = event.user;

    const dataInt = await dataLayer?.getDataIntegrationByConnectionId({ connectionId, name });

    let existingSyncTable = await dataLayer?.getSyncTableByDataIdAndType({
      dataIntegrationId: dataInt?.id!,
      type: `EMAIL`,
    });

    if (!existingSyncTable) {
      existingSyncTable = await dataLayer?.createSyncTable({
        dataIntegrationId: dataInt?.id!,
        type: `EMAIL`,
        connectionId,
      });

      await dataLayer?.addFieldsToSyncTable({
        syncTableId: existingSyncTable?.id!,
        fields: createGoogleMailFields(),
      });
    } else {
      const contactsTable = await dataLayer?.getSyncTableByDataIdAndType({
        dataIntegrationId: dataInt?.id!,
        type: `CONTACTS`,
      });

      if (contactsTable) {
        await dataLayer?.mergeExternalRecordsForSyncTable({
          syncTableId: contactsTable.id,
          records: contacts?.map((r: any) => {
            return {
              externalId: r.email,
              data: r,
            };
          }),
        });
      }
    }

    await dataLayer.mergeExternalRecordsForSyncTable({
      syncTableId: existingSyncTable?.id!,
      records: emails.map((r: any) => {
        return {
          externalId: r.messageId,
          data: r,
        };
      }),
    });
  },
});
