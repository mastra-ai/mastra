import { EventHandler, PropertyType } from '@mastra/core';

import { AsanaIntegration } from '../';

export const properties = [
  {
    name: 'gid',
    displayName: 'gid',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
  {
    name: 'name',
    displayName: 'Name',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
  {
    name: 'resource_type',
    displayName: 'Resource Type',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
  {
    name: 'resource_subtype',
    displayName: 'Resource Sub-Type',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
];

export const tasksSync: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, entityTypes, dataLayer, getApiClient },
}) => ({
  id: `${name}-sync-tasks`,
  event: eventKey,
  executor: async ({ event }) => {
    const { limit = 100, offset, assignee, project, section, workspace, completed_since, modified_since } = event.data;
    const { connectionId } = event.user;

    const api = await getApiClient({ connectionId });

    const res = api['/tasks'].get({
      query: {
        limit,
        offset,
        assignee,
        project,
        section,
        workspace,
        completed_since,
        modified_since,
      },
    });

    const data = await res.json();

    if ('data' in data) {
      const d = data.data || [];

      if (d.length === 0) {
        return;
      }

      const records = d.map(r => {
        return {
          externalId: r.gid,
          data: r,
          entityType: entityTypes.TASK,
        };
      });

      await dataLayer?.syncData({
        name,
        connectionId,
        data: records,
        properties,
        type: entityTypes.TASK,
        lastSyncId: event?.id!,
      });
    }
  },
});
