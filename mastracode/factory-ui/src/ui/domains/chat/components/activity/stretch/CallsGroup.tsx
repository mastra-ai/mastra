import { ActivityContent } from '@mastra/playground-ui/components/ai/activity';

import { stretchHeader } from '../activity-header';
import type { ToolView } from '../activity-header';
import { callsViewKeys, useActivityView } from '../activity-view';
import { ActivityFold } from './ActivityFold';
import { CALLS_PANEL, CallsPanel } from './CallsPanel';

/** Calls made between two thoughts, folded into one line that reads live only while one of them runs. */
export function CallsGroup({ tools, live }: { tools: ToolView[]; live: boolean }) {
  const view = useActivityView(callsViewKeys(tools));
  const running = live && tools.some(({ tool }) => tool.status === 'running');

  return (
    <ActivityFold header={stretchHeader(tools, running)} view={view} foldable>
      <ActivityContent className={CALLS_PANEL}>
        <CallsPanel tools={tools} live={running} />
      </ActivityContent>
    </ActivityFold>
  );
}
