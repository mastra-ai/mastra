import { EventHandler } from '@arkw/core';

import { AttachmentCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const AttachmentsForObject: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-AttachmentCompact-AttachmentsForObject`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { limit, offset, parent } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/attachments'].get({
      query: { limit, offset, parent },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching AttachmentsForObject', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `AttachmentCompact`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `AttachmentCompact`,
      properties: AttachmentCompactFields,
      lastSyncId: event?.id!,
    });
  },
});
