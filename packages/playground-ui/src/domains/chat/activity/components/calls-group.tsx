import type { ActivityCall } from '../model/activity-members';
import { useDisclosureStore, useIsOpen } from '../use-activity-disclosure';
import { ActivityFold } from './activity-fold';
import { CallsPanel } from './calls-panel';

/** Calls made between two thoughts, folded into one line that reads live only while one of them runs. */
export function CallsGroup({ calls, live }: { calls: readonly ActivityCall[]; live: boolean }) {
  const store = useDisclosureStore();
  const keys = calls.map(call => call.key);
  const open = useIsOpen(store, 'group', keys);
  const running = live && calls.some(call => call.status === 'running');

  function toggle(next: boolean) {
    store.setOpen('group', keys, next);
  }

  return (
    <ActivityFold calls={calls} live={running} open={open} onOpenChange={toggle} foldable>
      <CallsPanel calls={calls} live={running} />
    </ActivityFold>
  );
}
