import { X } from 'lucide-react';
import { getSignalHue } from './signal-colors';
import { formatSignalName } from './signal-formatting';
import type { ThemeSelection } from './theme-drilldown-data';
import { Button } from '@/ds/components/Button';
import { nodeColor } from '@/ds/components/SankeyChart';

export function ThemeFilterBanner({
  selection,
  filteredTraceCount,
  totalTraceCount,
  onViewDetails,
  onClear,
}: {
  selection: ThemeSelection;
  filteredTraceCount?: number;
  totalTraceCount: number;
  onViewDetails: () => void;
  onClear: () => void;
}) {
  const color = nodeColor(getSignalHue(selection.signalName));

  return (
    <section
      aria-label="Active theme drill-in"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      <button
        aria-label="Clear theme filter"
        className="border-border1 bg-surface2 text-neutral6 hover:bg-surface4 flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-2.5 text-xs font-medium transition-colors"
        onClick={onClear}
        type="button"
      >
        <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: color }} />
        {formatSignalName(selection.signalName)} · {selection.label}
        <X aria-hidden="true" className="size-3.5" />
      </button>
      <span className="text-neutral4 text-xs">
        {filteredTraceCount === undefined
          ? 'Loading theme traces…'
          : `Showing the ${filteredTraceCount} of ${totalTraceCount} traces that flow through this theme`}
      </span>
      <Button
        aria-label={`View theme details for ${selection.label}`}
        onClick={onViewDetails}
        size="sm"
        type="button"
        variant="ghost"
      >
        Details →
      </Button>
    </section>
  );
}
