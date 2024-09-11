import { EventHandler } from '@kepler/core';

import { AuditLogEventFields } from '../constants';

import { AsanaIntegration } from '..';

export const AuditLogEvents: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-AuditLogEvent-AuditLogEvents`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { workspace_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/workspaces/{workspace_gid}/audit_log_events'].get({
      params: { workspace_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching AuditLogEvents', JSON.stringify(error, null, 2));
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
      lastSyncId: event?.id!,
    });
  },
});
