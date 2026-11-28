import { VersionTimelineDetail, VersionTimelineItem, VersionTimelineRoot } from './version-timeline';

export const VersionTimeline = Object.assign(VersionTimelineRoot, {
  Item: VersionTimelineItem,
  Detail: VersionTimelineDetail,
});
export type { VersionState, VersionTimelineItemProps, VersionTimelineProps } from './version-timeline';
