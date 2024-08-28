import { EventHandler } from '@arkw/core';

import { AuditLogEventFields } from '../constants';

import { AsanaIntegration } from '..';

export const AuditLogEvents: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getProxy },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-AuditLogEvent`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { workspace_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getProxy({ referenceId });

    // @ts-ignore
    const response = await proxy['/workspaces/{workspace_gid}/audit_log_events'].get({
      params: { workspace_gid },
    });

    if (!response.ok) {
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `AuditLogEvent`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `AuditLogEvent`,
      properties: AuditLogEventFields,
    });
  },
});
