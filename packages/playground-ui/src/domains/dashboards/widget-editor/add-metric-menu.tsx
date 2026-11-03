import { CoinsIcon, GaugeIcon, HashIcon, PlusIcon, SparklesIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { EDITOR_KINDS, METRIC_GROUPS } from './catalogue';
import type { CatalogueEntry, EditorKind, MetricGroup } from './catalogue';
import { KindGlyph, KindTiles } from './kind-tiles';
import { WIDGET_PRESETS } from './presets';
import type { WidgetPreset } from './presets';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ds/components/Command';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

const GROUP_ICONS: Record<MetricGroup, LucideIcon> = {
  Usage: HashIcon,
  Cost: CoinsIcon,
  Performance: GaugeIcon,
  Quality: SparklesIcon,
};

export type MetricCommandProps = {
  /** The catalogue entries the view can take as it stands. */
  entries: CatalogueEntry[];
  /** Set while the view is empty: it can still start from a kind or a ready-made widget. */
  start?: {
    kind: EditorKind;
    onKind: (kind: EditorKind) => void;
    onPreset: (preset: WidgetPreset) => void;
  };
  onPick: (entry: CatalogueEntry) => void;
  className?: string;
};

/**
 * Searches the catalogue. An empty view first picks a type above the search, and is offered
 * ready-made widgets below it until the search narrows to metrics.
 */
export function MetricCommand({ entries, start, onPick, className }: MetricCommandProps) {
  const [search, setSearch] = useState('');
  const browsing = start && !search;
  const groups = METRIC_GROUPS.map(group => ({ group, items: entries.filter(e => e.group === group) })).filter(
    g => g.items.length > 0,
  );

  return (
    <Command loop data-heading-case="sentence" className={cn('bg-transparent', className)}>
      {/* The type and the metric are one choice, made top to bottom. */}
      <div className="flex flex-col gap-3 px-4 pt-4">
        {start && (
          <div className="flex flex-col gap-2">
            <Txt as="h4" variant="label" tone="muted">
              Pick a type, then a metric
            </Txt>
            <KindTiles
              kinds={EDITOR_KINDS.filter(k => k.value !== 'scores')}
              value={start.kind}
              onChange={start.onKind}
            />
          </div>
        )}
        <CommandInput
          autoFocus
          value={search}
          onValueChange={setSearch}
          placeholder="Search a metric: tokens, latency, score…"
          wrapperClassName="rounded-lg border border-border"
        />
      </div>

      {browsing ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-border p-4">
          <Txt as="h4" variant="label" tone="muted">
            Or start from a ready-made widget
          </Txt>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WIDGET_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => start.onPreset(preset)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-left',
                  'focus-visible:ring-ring hover:bg-fill-subtle focus-visible:ring-2 focus-visible:outline-none',
                )}
              >
                <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-fill-subtle">
                  <KindGlyph kind={preset.kind} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <Txt as="span" variant="body-sm" tone="ink" className="truncate">
                    {preset.title}
                  </Txt>
                  <Txt as="span" variant="caption" tone="muted">
                    {preset.description}
                  </Txt>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <CommandList className="max-h-80 px-3 pt-2 pb-3">
          <CommandEmpty>No metric matches.</CommandEmpty>
          {groups.map(({ group, items }) => {
            const Icon = GROUP_ICONS[group];
            return (
              <CommandGroup key={group} heading={group}>
                {items.map(entry => (
                  <CommandItem
                    key={entry.id}
                    value={entry.id}
                    keywords={[entry.label, entry.description, group]}
                    onSelect={() => {
                      onPick(entry);
                      setSearch('');
                    }}
                  >
                    <Icon />
                    <span className="min-w-0 shrink-0 text-foreground">{entry.label}</span>
                    <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">
                      {entry.description}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      )}
    </Command>
  );
}

export type AddMetricMenuProps = Pick<MetricCommandProps, 'entries' | 'onPick'> & { disabled?: boolean };

/** "Add metric", opening the catalogue search. */
export function AddMetricMenu({ entries, disabled, onPick }: AddMetricMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger variant="ghost" size="sm" disabled={disabled}>
        <PlusIcon />
        Add metric
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(36rem,calc(100vw-2rem))] p-0">
        {/* Remounted on every open, so the search starts empty. */}
        {open && (
          <MetricCommand
            entries={entries}
            onPick={entry => {
              onPick(entry);
              setOpen(false);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
