import { DataLayer, IntegrationApi } from '@kpl/core';
import { z } from 'zod';

import { makeRewatchRecords, REWATCH_FIELDS } from '../constants';
import { videoUploadedPayload, blankSchema } from '../schemas';
import { MakeClient } from '../types';

export const ATTACH_RECORDING = ({
  name,
  dataAccess,
  makeClient,
  entityType,
}: {
  name: string;
  dataAccess: DataLayer;
  makeClient: MakeClient;
  entityType: string;
}): IntegrationApi<z.infer<typeof videoUploadedPayload>, z.infer<typeof blankSchema>> => ({
  integrationName: name,
  type: 'ATTACH_RECORDING',
  label: 'Attach recording to attendees',
  description: 'Create a new channel',
  icon: {
    alt: 'Rewatch Icon',
    icon: '',
  },
  schema: videoUploadedPayload,
  outputSchema: blankSchema,
  executor: async ({ data, ctx: { connectionId } }) => {
    const client = await makeClient({ connectionId });

    const video = await client.getVideo(data.videoId);

    if (!video) {
      return {};
    }

    const emails = video.attendeesInfo.map(attendee => attendee.email) as string[];

    const people = await dataAccess.getRecordByPropertyNameAndValues({
      propertyName: 'email',
      propertValues: emails,
      connectionId,
    });

    const record = makeRewatchRecords({ video, people });

    await dataAccess.syncData({
      name,
      connectionId,
      data: [
        {
          ...record,
          entityType,
        },
      ],
      type: entityType,
      properties: REWATCH_FIELDS,
    });

    return {};
  },
});
