import { X } from 'lucide-react';
import { getSignalHue } from './signal-colors';
import { formatSignalName } from './signal-formatting';
import type { ThemeSelection } from './theme-drilldown-data';
import { Button } from '@/ds/components/Button';
import { nodeColor } from '@/ds/components/SankeyChart';

function selectionLabel(selection: ThemeSelection) {
  return `${formatSignalName(selection.signalName)} · ${selection.kind === 'theme' ? selection.label : 'Noise'}`;
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
            aria-label={selections.length === 1 ? 'Clear theme filter' : `Clear filter ${selectionLabel(selection)}`}
            className="border-border1 bg-surface2 text-neutral6 hover:bg-surface4 flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-2.5 text-xs font-medium transition-colors"
            onClick={() => onRemove(selection.signalName)}
            type="button"
          >
            <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: color }} />
            {selectionLabel(selection)}
            <X aria-hidden="true" className="size-3.5" />
          </button>
        );
      })}
      <span className="text-neutral4 text-xs">
        {isUnavailable
          ? 'Filters unavailable for this snapshot'
          : filteredTraceCount === undefined
            ? 'Loading matching traces…'
            : selections.length === 1
              ? `Showing the ${filteredTraceCount} of ${totalTraceCount} traces that flow through this theme`
              : `Showing the ${filteredTraceCount} of ${totalTraceCount} traces that match these filters`}
      </span>
      {!isUnavailable && filteredTraceCount !== undefined && latestSelection ? (
        <Button
          aria-label={`View details for ${selectionLabel(latestSelection)}`}
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
