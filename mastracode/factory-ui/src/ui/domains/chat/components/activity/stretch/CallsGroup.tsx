import { ActivityContent } from '@mastra/playground-ui/components/ai/activity';

import { stretchHeader } from '../activity-header';
import type { ToolView } from '../activity-header';
import { usePanelView } from '../activity-view';
import type { ActivityView } from '../activity-view';
import { ActivityFold } from './ActivityFold';
import { CALLS_PANEL, CallsPanel } from './CallsPanel';

/**
 * Calls made between two thoughts, folded into one line that reads live only while one of them runs. It
 * starts open when the reader already had its calls in view: listed on their own, or a row of it opened.
 */
export function CallsGroup({ tools, view, live }: { tools: ToolView[]; view: ActivityView; live: boolean }) {
  const keys = tools.map(({ key }) => key);
  const panel = usePanelView(
    view,
    keys,
    keys.some(key => view.openRows.has(key)),
  );
  const running = live && tools.some(({ tool }) => tool.status === 'running');

  return (
    <ActivityFold header={stretchHeader(tools, running)} view={panel} foldable>
      <ActivityContent className={CALLS_PANEL}>
        <CallsPanel tools={tools} view={view} live={running} />
      </ActivityContent>
    </ActivityFold>
  );
}
