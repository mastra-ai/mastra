import type { SignalCatalogEntry } from '@mastra/client-js';
import { X } from 'lucide-react';
import { getSignalHue } from './signal-colors';
import { signalLabel } from './signal-formatting';
import type { ThemeSelection } from './theme-drilldown-data';
import { useTraceIntelligence } from './use-trace-intelligence';
import { Button } from '@/ds/components/Button';
import { nodeColor } from '@/ds/components/SankeyChart';

function selectionLabel(catalog: readonly SignalCatalogEntry[], selection: ThemeSelection) {
  return `${signalLabel(catalog, selection.signalName)} · ${selection.kind === 'theme' ? selection.label : 'Noise'}`;
}

function filterSummary({
  selections,
  filteredTraceCount,
  totalTraceCount,
  isUnavailable,
}: {
  selections: ThemeSelection[];
  filteredTraceCount?: number;
  totalTraceCount: number;
  isUnavailable?: boolean;
}) {
  if (isUnavailable) return 'Filters unavailable for this snapshot';
  if (filteredTraceCount === undefined) return 'Loading matching traces…';
  const onlySelection = selections.length === 1 ? selections[0] : undefined;
  if (onlySelection?.kind === 'noise') {
    return `Showing the ${filteredTraceCount} of ${totalTraceCount} traces assigned to Noise`;
  }
  if (onlySelection) {
    return `Showing the ${filteredTraceCount} of ${totalTraceCount} traces that flow through this theme`;
  }
  return `Showing the ${filteredTraceCount} of ${totalTraceCount} traces that match these filters`;
}

export function ThemeFilterBanner({
  selections,
  filteredTraceCount,
  totalTraceCount,
  isUnavailable,
  onViewDetails,
  onRemove,
  onClear,
}: {
  selections: ThemeSelection[];
  filteredTraceCount?: number;
  totalTraceCount: number;
  isUnavailable?: boolean;
  onViewDetails: (selection: ThemeSelection) => void;
  onRemove: (signalName: ThemeSelection['signalName']) => void;
  onClear: () => void;
}) {
  const { signalCatalog } = useTraceIntelligence();
  const colors = selections.map(selection => nodeColor(getSignalHue(selection.signalName)));
  const latestSelection = selections.at(-1);
  const backgroundGradient = `linear-gradient(90deg, ${colors
    .map(color => `color-mix(in srgb, ${color} 8%, transparent)`)
    .join(', ')})`;
  const borderGradient = `linear-gradient(90deg, ${colors
    .map(color => `color-mix(in srgb, ${color} 35%, transparent)`)
    .join(', ')})`;

  return (
    <section
      aria-label="Active theme drill-in"
      className="relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-transparent px-3 py-2"
      style={{ backgroundImage: `${backgroundGradient}, ${borderGradient}`, backgroundClip: 'padding-box, border-box' }}
    >
      {selections.map((selection, index) => {
        const color = colors[index];
        return (
          <button
            key={selection.signalName}
            aria-label={
              selections.length === 1
                ? `Clear ${selection.kind} filter`
                : `Clear filter ${selectionLabel(signalCatalog, selection)}`
            }
            className="border-border1 bg-surface2 text-neutral6 hover:bg-surface4 flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-2.5 text-xs font-medium transition-colors"
            onClick={() => onRemove(selection.signalName)}
            type="button"
          >
            <span aria-hidden="true" className="rounded-0.5 size-2" style={{ backgroundColor: color }} />
            {selectionLabel(signalCatalog, selection)}
            <X aria-hidden="true" className="size-3.5" />
          </button>
        );
      })}
      <span className="text-neutral4 text-xs">
        {filterSummary({ selections, filteredTraceCount, totalTraceCount, isUnavailable })}
      </span>
      {!isUnavailable && filteredTraceCount !== undefined && latestSelection ? (
        <Button
          aria-label={
            latestSelection.kind === 'theme'
              ? `View theme details for ${latestSelection.label}`
              : `View noise details for ${signalLabel(signalCatalog, latestSelection.signalName)}`
          }
          onClick={() => onViewDetails(latestSelection)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Details →
        </Button>
      ) : null}
      {selections.length > 1 ? (
        <Button onClick={onClear} size="sm" type="button" variant="ghost">
          Clear all
        </Button>
      ) : null}
    </section>
  );
}
