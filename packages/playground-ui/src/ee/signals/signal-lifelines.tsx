import { useState } from 'react';

import { LifelineRow } from './lifeline-row';
import { getSignalColor } from './signal-colors';
import { signalDescription, signalLabel } from './signal-formatting';
import type { ThemeSelection } from './theme-drilldown-data';
import { buildThemeLifelines } from './theme-lifelines-data';
import type { ThemeFlowResponse, ThemeSnapshot, TraceSignalName } from './types';
import { useTraceIntelligence } from './use-trace-intelligence';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';

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
  const { signalCatalog } = useTraceIntelligence();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const rows = buildThemeLifelines(flows, signalName);
  const color = getSignalColor(signalName);
  const label = signalLabel(signalCatalog, signalName);

  return (
    <section aria-label={`${label} lifelines`} className="min-w-0">
      <h3 className="flex" style={{ color }}>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                aria-expanded={!isCollapsed}
                aria-label={label}
                className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                onClick={() => setIsCollapsed(previous => !previous)}
                type="button"
              />
            }
          >
            <DisclosureChevron direction="right" className="size-3.5" />
            <Txt as="span" variant="eyebrow">
              {label}
            </Txt>
          </TooltipTrigger>
          <TooltipContent>{signalDescription(signalCatalog, signalName)}</TooltipContent>
        </Tooltip>
      </h3>
      {isCollapsed ? undefined : rows.length === 0 ? (
        <Txt variant="caption" tone="muted" className="mt-2">
          No themes in these landmarks.
        </Txt>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {rows.map(row => (
            <LifelineRow
              key={row.label}
              row={row}
              signalName={signalName}
              snapshots={snapshots}
              positions={positions}
              onThemeSelect={onThemeSelect}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
