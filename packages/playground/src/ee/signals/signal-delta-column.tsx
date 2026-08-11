import { nodeColor } from '@mastra/playground-ui/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { getSignalHue } from '@mastra/playground-ui/ee/signals';

import { formatSignalName, SIGNAL_DESCRIPTIONS } from './signal-formatting';
import { computeThemeShareDeltas, themeShareSeries } from './theme-compare-data';
import { ThemeCompareSparkline } from './theme-compare-sparkline';
import type { ThemeSelection } from './theme-drilldown-data';
import type { ThemeFlowResponse, TraceSignalName } from './types';

function percent(share: number) {
  return `${Math.round(share * 100)}%`;
}

function deltaLabel(delta: number) {
  const points = Math.round(delta * 100);
  return `${points >= 0 ? '+' : ''}${points}%`;
}

export function SignalDeltaColumn({
  signalName,
  fromFlow,
  toFlow,
  flows,
  positions,
  fromIndex,
  toIndex,
  onThemeSelect,
}: {
  signalName: TraceSignalName;
  fromFlow: ThemeFlowResponse;
  toFlow: ThemeFlowResponse;
  flows: Array<ThemeFlowResponse | undefined>;
  positions: number[];
  fromIndex: number;
  toIndex: number;
  onThemeSelect: (selection: ThemeSelection, snapshotIndex: number) => void;
}) {
  const deltas = computeThemeShareDeltas(fromFlow, toFlow, signalName);
  const detailIndexFor = (delta: { toShare: number }) => (delta.toShare > 0 ? toIndex : fromIndex);

  return (
    <section aria-label={`${formatSignalName(signalName)} changes`} className="min-w-0">
      <h3
        className="font-mono text-xs font-semibold tracking-widest uppercase"
        style={{ color: nodeColor(getSignalHue(signalName)) }}
      >
        <Tooltip>
          <TooltipTrigger className="cursor-default uppercase">{signalName}</TooltipTrigger>
          <TooltipContent>{SIGNAL_DESCRIPTIONS[signalName]}</TooltipContent>
        </Tooltip>
      </h3>
      <ul className="mt-2 space-y-1.5">
        {deltas.length === 0 ? <li className="text-neutral3 text-xs">No themes in either snapshot.</li> : null}
        {deltas.map(delta => {
          const themeId = delta.themeId;
          const card = (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-neutral6 truncate text-xs font-medium" title={delta.label}>
                  {delta.label}
                </span>
                <span className="text-neutral6 shrink-0 font-mono text-xs font-semibold tabular-nums">
                  {deltaLabel(delta.delta)}
                </span>
              </div>
              <p className="text-neutral3 font-mono text-[11px] tabular-nums">
                {percent(delta.fromShare)} → {percent(delta.toShare)}
              </p>
              <ThemeCompareSparkline
                series={themeShareSeries(flows, signalName, delta.label)}
                positions={positions}
                markerIndexes={[fromIndex, toIndex]}
              />
            </>
          );
          return (
            <li
              key={delta.label}
              className={`border-border1 rounded-lg border ${
                delta.delta > 0 ? 'bg-green-500/5' : delta.delta < 0 ? 'bg-red-500/5' : 'bg-surface3'
              }`}
            >
              {themeId === undefined ? (
                <div className="px-2.5 py-2">{card}</div>
              ) : (
                <button
                  aria-label={`View theme details for ${delta.label}`}
                  className="hover:border-border2 block w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.03]"
                  onClick={() => onThemeSelect({ signalName, themeId, label: delta.label }, detailIndexFor(delta))}
                  type="button"
                >
                  {card}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
