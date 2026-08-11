import { nodeColor } from '@mastra/playground-ui/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { getSignalHue } from '@mastra/playground-ui/ee/signals';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { LifelineRow } from './lifeline-row';
import { formatSignalName, SIGNAL_DESCRIPTIONS } from './signal-formatting';
import type { ThemeSelection } from './theme-drilldown-data';
import { buildThemeLifelines } from './theme-lifelines-data';
import type { ThemeFlowResponse, ThemeSnapshot, TraceSignalName } from './types';

export function SignalLifelines({
  signalName,
  flows,
  snapshots,
  positions,
  onThemeSelect,
}: {
  signalName: TraceSignalName;
  flows: Array<ThemeFlowResponse | undefined>;
  snapshots: ThemeSnapshot[];
  positions: number[];
  onThemeSelect: (selection: ThemeSelection, snapshotIndex: number) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const rows = buildThemeLifelines(flows, signalName);
  const hue = getSignalHue(signalName);

  return (
    <section aria-label={`${formatSignalName(signalName)} lifelines`} className="min-w-0">
      <h3 className="font-mono text-xs font-semibold tracking-widest uppercase" style={{ color: nodeColor(hue) }}>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                aria-expanded={!isCollapsed}
                className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                onClick={() => setIsCollapsed(previous => !previous)}
                type="button"
              />
            }
          >
            <ChevronDown
              aria-hidden="true"
              className={`size-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
            />
            {signalName}
          </TooltipTrigger>
          <TooltipContent>{SIGNAL_DESCRIPTIONS[signalName]}</TooltipContent>
        </Tooltip>
      </h3>
      {isCollapsed ? undefined : rows.length === 0 ? (
        <p className="text-neutral3 mt-2 text-xs">No themes in these landmarks.</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {rows.map(row => (
            <LifelineRow
              key={row.label}
              row={row}
              signalName={signalName}
              snapshots={snapshots}
              positions={positions}
              hue={hue}
              onThemeSelect={onThemeSelect}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
