import type { ActivityCall, ActivityMember, ActivityThought } from './activity-members';
import { groupConsecutive } from '@/ds/components/ai/tool-call';

export interface ActivityCallGroup {
  kind: 'calls';
  key: string;
  calls: ActivityCall[];
}

/** What an open stretch lists: each thought, a lone call, or the calls made between two thoughts. */
export type ActivitySegment = ActivityThought | ActivityCall | ActivityCallGroup;

export function activitySegments(members: readonly ActivityMember[]): ActivitySegment[] {
  const groups = groupConsecutive<ActivityMember, ActivityCall>(members, {
    key: member => member.key,
    joins: (member): member is ActivityCall => member.kind === 'call',
    min: 2,
  });
  return members.flatMap((member): ActivitySegment[] => {
    const calls = groups.byFirstKey.get(member.key);
    if (calls) return [{ kind: 'calls', key: member.key, calls }];
    return groups.memberKeys.has(member.key) ? [] : [member];
  });
}
