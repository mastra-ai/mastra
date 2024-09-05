import { EventHandler } from '@arkw/core';

import { CustomFieldSettingResponseFields } from '../constants';

import { AsanaIntegration } from '..';

export const CustomFieldSettingsForProject: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-CustomFieldSettingResponse-CustomFieldSettingsForProject`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { project_gid } = event.data;
    const { referenceId } = event.user;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/projects/{project_gid}/custom_field_settings'].get({
      params: { project_gid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching CustomFieldSettingsForProject', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    // @ts-ignore
    const records = d?.data?.map(({ _externalId, ...d2 }) => ({
      externalId: _externalId,
      data: d2,
      entityType: `CustomFieldSettingResponse`,
    }));

    await dataLayer?.syncData({
      name,
      referenceId,
      data: records,
      type: `CustomFieldSettingResponse`,
      properties: CustomFieldSettingResponseFields,
    });
  },
});
