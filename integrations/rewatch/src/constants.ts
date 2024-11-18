import { PropertyType, Record } from '@mastra/core';

import { Video } from './types';

export const REWATCH_INTEGRATION_NAME = 'REWATCH';

export const REWATCH_FIELDS = [
  {
    name: `title`,
    displayName: `Title`,
    order: 0,
    type: PropertyType.SINGLE_LINE_TEXT,
  },
  {
    name: `description`,
    displayName: `Description`,
    order: 1,
    type: PropertyType.SINGLE_LINE_TEXT,
  },
  {
    name: `duration`,
    displayName: `Duration`,
    order: 2,
    type: PropertyType.SINGLE_LINE_TEXT,
  },
  {
    name: `url`,
    displayName: `Recording URL`,
    order: 3,
    type: PropertyType.URL,
  },
  {
    name: `attendees`,
    displayName: `Attendees`,
    order: 4,
    type: PropertyType.MULTI_SELECT,
  },
];

export function makeRewatchRecords({ video, people }: { video: Video; people: Record[] }) {
  const data = {
    title: video.title,
    description: video.description,
    duration: video.duration,
    url: video.url,
    attendees: people.map(person => person.id),
  };

  return {
    data,
    externalId: video.id,
  };
}
