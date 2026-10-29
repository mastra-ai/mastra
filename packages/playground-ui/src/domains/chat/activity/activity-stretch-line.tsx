import { ActivityFold } from './components/activity-fold';
import { StretchContent } from './components/stretch-content';
import type { ActivityCall, ActivityCallState, ActivityMember } from './model/activity-members';
import { activitySegments } from './model/activity-segments';
import type { ActivitySegment } from './model/activity-segments';
import { stretchPose } from './model/activity-words';
import type { ActivityDisclosureStore } from './model/disclosure-store';
import { ActivityDisclosureContext, useDisclosureStore, useIsOpen } from './use-activity-disclosure';
import { hasReasoningText } from '@/ds/components/ai/activity';

export interface ActivityStretchLineProps {
  members: readonly ActivityMember[];
  /** Still being written: reads what it is doing now, and its list follows the latest call. */
  live: boolean;
  /** From the first member to whatever ended the stretch. */
  elapsedMs?: number;
  /** The calls as they stand now, when a reveal still holds `members` back: the line reads and wears these. */
  current?: readonly ActivityCallState[];
}

function isCall(member: ActivityMember): member is ActivityCall {
  return member.kind === 'call';
}

function isListed(member: ActivityMember): boolean {
  return member.kind === 'call' || hasReasoningText(member.content);
}

function opensOnItsOwn(member: ActivityMember): boolean {
  return member.kind === 'call' ? member.body !== undefined : hasReasoningText(member.content);
}

/** What the reader sees in a stretch opened on a lone call or list stays open once a thought or call joins it. */
function keepListedOpen(store: ActivityDisclosureStore, segments: readonly ActivitySegment[]) {
  const [only] = segments;
  if (segments.length !== 1 || !only) return;
  if (only.kind === 'call') {
    store.setOpen('row', [only.key], true);
    store.setOpen('group', [only.key], true);
  }
  if (only.kind === 'calls') {
    store.setOpen(
      'group',
      only.calls.map(call => call.key),
      true,
    );
  }
}

/** One collapsed line for a stretch of tool work and thinking, opening onto what it did. */
export function ActivityStretchLine({ members, live, elapsedMs, current }: ActivityStretchLineProps) {
  const store = useDisclosureStore();
  const keys = members.map(member => member.key);
  const open = useIsOpen(store, 'line', keys);

  if (members.length === 0 && !live) return null;
  const listed = members.filter(isListed);
  const segments = activitySegments(listed);
  const calls = current ?? members.filter(isCall);

  function toggle(next: boolean) {
    store.setOpen('line', keys, next);
    if (next) keepListedOpen(store, segments);
  }

  return (
    <ActivityDisclosureContext value={store}>
      <ActivityFold
        slot="activity-stretch"
        calls={calls}
        pose={stretchPose(calls, live)}
        live={live}
        elapsedMs={elapsedMs}
        open={open}
        onOpenChange={toggle}
        foldable={listed.length > 1 || listed.some(opensOnItsOwn)}
        prominent
      >
        <StretchContent segments={segments} live={live} />
      </ActivityFold>
    </ActivityDisclosureContext>
  );
}
