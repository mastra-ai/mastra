import { DataLayer, IntegrationAction } from 'core';
import { z } from 'zod';

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
  pluginName: name,
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
    // @ts-ignore
    const people = await dataAccess.getRecordByFieldNameAndValues({
      fieldName: 'email',
      fieldValues: emails,
      connectionId,
    });

    // TODO: sync video to people
    // const activities = people.map(person => ({
    //   recordId: person.id,
    //   activityType: 'MEETING_RECORDED' as const,
    //   detail: video,
    // }));

    // await api.createActivities(activities);

    return {};
  },
});
