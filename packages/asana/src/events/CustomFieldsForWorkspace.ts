import { EventHandler } from '@arkw/core';

import { CustomFieldResponseFields } from '../constants';

import { AsanaIntegration } from '..';

export const CustomFieldsForWorkspace: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-CustomFieldResponse-CustomFieldsForWorkspace`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { workspace_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/workspaces/{workspace_gid}/custom_fields'].get({
      params: { workspace_gid },
    });

    if (!response.ok) {
      console.log('error in fetching CustomFieldsForWorkspace', { response });
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `CustomFieldResponse`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `CustomFieldResponse`,
      properties: CustomFieldResponseFields,
    });
  },
});
