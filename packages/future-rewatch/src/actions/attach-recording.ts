import { z } from 'zod';

import { DataLayer, IntegrationAction } from 'core';
import { videoUploadedPayload, blankSchema } from '../schemas';

// import { default as RewatchIcon } from '../assets/rewatch.svg';
import { MakeClient } from '../types';
import { REWATCH_INTEGRATION_NAME } from '../constants';

export const ATTACH_RECORDING = ({
  name,
  dataAccess,
  makeClient,
}: {
  name: string;
  dataAccess: DataLayer;
  makeClient: MakeClient;
}): IntegrationAction<z.infer<typeof videoUploadedPayload>, z.infer<typeof blankSchema>> => ({
  pluginName: REWATCH_INTEGRATION_NAME,
  type: 'ATTACH_RECORDING',
  label: 'Attach recording to attendees',
  description: 'Create a new channel',
  icon: {
    alt: 'Rewatch Icon',
    icon: "",
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
    const people = await dataAccess.getRecordByFieldNameAndValues({
      fieldName: 'email',
      fieldValues: emails,
      connectionId,
    });

    // TODO: Setup activities
    // const activities = people.map(person => ({
    //   recordId: person.id,
    //   activityType: 'MEETING_RECORDED' as const,
    //   detail: video,
    // }));

    // await api.createActivities(activities);

    return {};
  },
});
