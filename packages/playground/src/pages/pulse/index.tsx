import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PulseFlowDetail } from '@mastra/playground-ui/domains/pulse/components/pulse-flow-detail';
import { PulseFlowsList } from '@mastra/playground-ui/domains/pulse/components/pulse-flows-list';
import { useState } from 'react';

/**
 * Experimental Pulse observability page (event-first read model). Flows on the
 * left, the selected flow's span tree + pulse timeline on the right. Clicking
 * the selected row again clears the selection.
 *
 * The route is always registered (like /intelligence) but the sidebar entry is
 * hidden unless `window.MASTRA_PULSE_UI === 'true'` — see `lib/nav/nav-items.tsx`.
 */
export default function Pulse() {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  return (
    <PageLayout width="wide" height="full">
      <PageLayout.MainArea>
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
          <PulseFlowsList
            selectedFlowId={selectedFlowId}
            onSelectFlow={flowId => setSelectedFlowId(current => (current === flowId ? null : flowId))}
          />
          <div className="border-border1 min-h-0 overflow-y-auto rounded-lg border">
            <PulseFlowDetail flowId={selectedFlowId} />
          </div>
        </div>
      </PageLayout.MainArea>
    </PageLayout>
  );
}
