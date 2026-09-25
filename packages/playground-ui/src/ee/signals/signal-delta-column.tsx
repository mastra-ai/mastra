import { getSignalHue } from './signal-colors';
import { signalDescription, signalLabel } from './signal-formatting';
import { computeThemeShareDeltas, themeShareSeries } from './theme-compare-data';
import { ThemeCompareSparkline } from './theme-compare-sparkline';
import type { ThemeSelection } from './theme-drilldown-data';
import type { ThemeFlowResponse, TraceSignalName } from './types';
import { useTraceIntelligence } from './use-trace-intelligence';
import { nodeColor } from '@/ds/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';

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
  const { signalCatalog } = useTraceIntelligence();
  const label = signalLabel(signalCatalog, signalName);
  const deltas = computeThemeShareDeltas(fromFlow, toFlow, signalName);
  const detailIndexFor = (delta: { toShare: number }) => (delta.toShare > 0 ? toIndex : fromIndex);

  return (
    <section aria-label={`${label} changes`} className="min-w-0">
      <Txt as="h3" variant="column" className="uppercase" style={{ color: nodeColor(getSignalHue(signalName)) }}>
        <Tooltip>
          <TooltipTrigger aria-label={signalName} className="cursor-default uppercase">
            {label}
          </TooltipTrigger>
          <TooltipContent>{signalDescription(signalCatalog, signalName)}</TooltipContent>
        </Tooltip>
      </Txt>
      <ul className="mt-2 space-y-1.5">
        {deltas.length === 0 ? (
          <li className="text-caption text-muted-foreground">No themes in either snapshot.</li>
        ) : null}
        {deltas.map(delta => {
          const themeId = delta.themeId;
          const card = (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <Txt as="span" variant="column" tone="ink" className="truncate" title={delta.label}>
                  {delta.label}
                </Txt>
                <Txt as="span" variant="column" tone="ink" className="shrink-0 tabular-nums">
                  {deltaLabel(delta.delta)}
                </Txt>
              </div>
              <Txt variant="caption" tone="muted" className="tabular-nums">
                {percent(delta.fromShare)} → {percent(delta.toShare)}
              </Txt>
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
              className={`rounded-lg border border-border ${
                delta.delta > 0 ? 'bg-green-500/5' : delta.delta < 0 ? 'bg-red-500/5' : 'bg-card'
              }`}
            >
              {themeId === undefined ? (
                <div className="px-2.5 py-2">{card}</div>
              ) : (
                <button
                  aria-label={`View theme details for ${delta.label}`}
                  className="block w-full cursor-pointer rounded-lg px-2.5 py-2 text-left hover:border-border-strong hover:bg-white/[0.03]"
                  onClick={() =>
                    onThemeSelect({ kind: 'theme', signalName, themeId, label: delta.label }, detailIndexFor(delta))
                  }
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
