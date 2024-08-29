import { EventHandler } from '@arkw/core';

import { AttachmentCompactFields } from '../constants';

import { AsanaIntegration } from '..';

export const AttachmentsForObject: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-AttachmentCompact`,
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
    });
  },
});
