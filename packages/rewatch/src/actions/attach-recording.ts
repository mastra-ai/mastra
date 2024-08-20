import { DataLayer, IntegrationAction } from '@arkw/core';
import { z } from 'zod';

import { makeRewatchRecords, REWATCH_FIELDS, SYNC_TABLE_TYPE } from '../constants';
import { videoUploadedPayload, blankSchema } from '../schemas';
import { MakeClient } from '../types';

export const ATTACH_RECORDING = ({
  name,
  dataAccess,
  makeClient,
}: {
  name: string;
  dataAccess: DataLayer;
  makeClient: MakeClient;
}): IntegrationAction<z.infer<typeof videoUploadedPayload>, z.infer<typeof blankSchema>> => ({
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
  executor: async ({ data, ctx: { referenceId } }) => {
    const client = await makeClient({ referenceId });

    const video = await client.getVideo(data.videoId);

    if (!video) {
      return {};
    }

    const emails = video.attendeesInfo.map(attendee => attendee.email) as string[];
    // @ts-ignore
    const people = await dataAccess.getRecordByPropertyNameAndValues({
      propertyName: 'email',
      propertValues: emails,
      referenceId,
    });

    const record = makeRewatchRecords({ video, people });

    await dataAccess.syncData({
      name,
      referenceId,
      data: [record],
      type: SYNC_TABLE_TYPE,
      properties: REWATCH_FIELDS,
    });

    return {};
  },
});
