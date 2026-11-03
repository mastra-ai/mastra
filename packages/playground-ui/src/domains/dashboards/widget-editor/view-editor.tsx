import { PlusIcon, SigmaIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { chartColor } from '../lib/format';
import type { Scorer } from '../lib/scores';
import { CHART_COLOR_NAMES } from '../lib/values';
import {
  AGGREGATION_LABELS,
  DIMENSIONS,
  METRIC_GROUPS,
  aggregationsFor,
  catalogue,
  dimensionLabel,
  findEntry,
  isTimeseriesKind,
} from './catalogue';
import type { Aggregation, CatalogueEntry, EditorKind } from './catalogue';
import { defaultComboLabel, defaultIcon, defaultMetricLabel, fitsWith, seriesColor } from './codec';
import { COMBINE_OPS, MAX_METRICS_PER_VIEW, combineKey, metricKey, splitLabel } from './draft';
import type { ChartColor, CombineDraft, KpiIcon, MetricDraft, ViewDraft, WidgetDraft } from './draft';
import { HintButton } from './hint-button';
import { useDimensionSuggestions, useDimensionValues } from './use-dimension-values';
import { Button } from '@/ds/components/Button';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxItemContent,
  ComboboxItemDescription,
  ComboboxItemTitle,
  ComboboxLabel,
  ComboboxList,
  ComboboxRoot,
  ComboboxSearch,
  ComboboxSeparator,
  ComboboxTrigger,
} from '@/ds/components/Combobox';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Field, FieldLabel } from '@/ds/components/Field';
import { FilterBar } from '@/ds/components/FilterBar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@/ds/components/FilterBar';
import { chipClass, editableSegmentClass, removeSegmentClass } from '@/ds/components/FilterBar/filter-bar-chip';
import { Input } from '@/ds/components/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { SeriesMark } from '@/ds/components/SeriesMark';
import { Switch } from '@/ds/components/Switch';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

const NONE = 'none';

/** Widget queries filter on equality only. */
const FILTER_OPERATORS: FilterBarOperator[] = [{ id: 'is', label: 'is' }];

const KPI_ICONS: { value: KpiIcon; label: string }[] = [
  { value: 'hash', label: 'Count' },
  { value: 'coins', label: 'Coins' },
  { value: 'bot', label: 'Agent' },
  { value: 'threads', label: 'Threads' },
];

const COLOR_ITEMS = CHART_COLOR_NAMES.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }));

export type ViewEditorProps = {
  index: number;
  /** The kind the widget draws as, picked or suggested. */
  kind: EditorKind;
  scorers: readonly Scorer[];
};

/**
 * One view's form: metrics and combinations as chips, filters, then the split. Every choice it
 * offers keeps each metric and combination drawable in the widget's kind; the rest is left out.
 */
export function ViewEditor({ index, kind, scorers }: ViewEditorProps) {
  const { control, getValues, setValue } = useFormContext<WidgetDraft>();
  const draft = useWatch({ control }) as WidgetDraft;
  const view = useWatch({ control, name: `views.${index}` });
  const set = (patch: Partial<ViewDraft>) =>
    setValue(`views.${index}`, { ...getValues(`views.${index}`), ...patch }, { shouldDirty: true });
  const fits = (patch: Partial<ViewDraft>) => fitsWith(draft, index, patch, scorers);

  const entries = view.metrics.map(m => findEntry(m.entry, scorers));
  const shownEntries = entries.filter(e => e !== undefined);
  const hasScores = entries.some(e => e?.source === 'scores');
  const split = splitLabel(kind);

  const updateMetric = (key: string, patch: Partial<MetricDraft>) =>
    set({ metrics: view.metrics.map(m => (m.key === key ? { ...m, ...patch } : m)) });
  const updateCombo = (key: string, patch: Partial<CombineDraft>) =>
    set({ combos: view.combos.map(c => (c.key === key ? { ...c, ...patch } : c)) });

  // A combination goes with either of its metrics.
  const removeMetric = (key: string) => {
    const metrics = view.metrics.filter(m => m.key !== key);
    const combos = view.combos.filter(c => c.a !== key && c.b !== key);
    const kept = [...metrics, ...combos].some(item => item.key === view.sort);
    set({ metrics, combos, sort: kept ? view.sort : undefined });
  };
  const removeCombo = (key: string) =>
    set({ combos: view.combos.filter(c => c.key !== key), sort: view.sort === key ? undefined : view.sort });

  const withCombo = (combo: CombineDraft) => ({ combos: [...view.combos, combo] });
  // Each formula is offered over the first pair of metrics it can combine here.
  const comboStarts = COMBINE_OPS.flatMap(op => {
    for (const a of view.metrics)
      for (const b of view.metrics) {
        const combo = { key: combineKey(), op: op.value, a: a.key, b: b.key };
        if (a !== b && fits(withCombo(combo))) return [combo];
      }
    return [];
  });

  const metricOptions = view.metrics.map((m, i) => ({
    value: m.key,
    label: m.label || (entries[i] ? defaultMetricLabel(entries[i], m.aggregation) : m.entry),
  }));
  const labelOf = (key: string) => metricOptions.find(o => o.value === key)?.label ?? key;
  const comboLabel = (c: CombineDraft) => c.label || defaultComboLabel(c.op, labelOf(c.a), labelOf(c.b));

  // A series takes the palette color of its place, as the codec draws it.
  const colors = isTimeseriesKind(kind) && !view.splitBy ? seriesColors(view) : undefined;

  const atLimit = view.metrics.length >= MAX_METRICS_PER_VIEW;
  const splitBlocksCombos = isTimeseriesKind(kind) && !!view.splitBy;
  const empty = view.metrics.length === 0 && view.combos.length === 0;

  // An entry is offered with the first aggregation that fits; the default one stays implicit.
  const withMetric = (metric: MetricDraft) => ({ metrics: [...view.metrics, metric] });
  const pickable = atLimit
    ? []
    : catalogue(scorers).flatMap(entry => {
        const tries = entry.source === 'metrics' ? [undefined, ...entry.aggregations] : [undefined];
        const aggregation = tries.find(a => fits(withMetric({ key: 'probe', entry: entry.id, aggregation: a })));
        const fitting = aggregation !== undefined || fits(withMetric({ key: 'probe', entry: entry.id }));
        return fitting ? [{ entry, aggregation }] : [];
      });
  const pickMetric = (entry: CatalogueEntry) => {
    const aggregation = pickable.find(p => p.entry.id === entry.id)?.aggregation;
    set(withMetric({ key: metricKey(), entry: entry.id, aggregation }));
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Metrics">
        <div className="flex flex-wrap items-center gap-1.5">
          {view.metrics.map((metric, i) => {
            const entry = entries[i];
            const allowed = entry?.source === 'metrics' ? (aggregationsFor(entry, kind) ?? []) : [];
            const aggregation = metric.aggregation ?? allowed[0];
            const options = allowed.filter(
              a =>
                a === aggregation ||
                fits({ metrics: view.metrics.map(m => (m.key === metric.key ? { ...m, aggregation: a } : m)) }),
            );
            const placeholder = entry ? defaultMetricLabel(entry, aggregation) : metric.entry;
            return (
              <ItemChip
                key={metric.key}
                label={metric.label || placeholder}
                color={colors?.[metric.key]?.color}
                onRemove={() => removeMetric(metric.key)}
              >
                {entry && (
                  <Txt variant="caption" tone="muted">
                    {entry.group} · {entry.description}
                  </Txt>
                )}
                {aggregation && options.length > 1 && (
                  <AggregationSelect
                    options={options}
                    value={aggregation}
                    onChange={aggregation => updateMetric(metric.key, { aggregation })}
                  />
                )}
                <Presentation
                  draft={metric}
                  kind={kind}
                  placeholder={placeholder}
                  defaultIcon={entry ? defaultIcon(entry) : 'hash'}
                  color={colors?.[metric.key]}
                  onChange={patch => updateMetric(metric.key, patch)}
                />
              </ItemChip>
            );
          })}
          {view.combos.map(combo => (
            <ItemChip
              key={combo.key}
              label={comboLabel(combo)}
              color={colors?.[combo.key]?.color}
              onRemove={() => removeCombo(combo.key)}
            >
              <ComboOperands
                combo={combo}
                options={metricOptions}
                fits={patch => fits({ combos: view.combos.map(c => (c.key === combo.key ? { ...c, ...patch } : c)) })}
                onChange={patch => updateCombo(combo.key, patch)}
              />
              <Presentation
                draft={combo}
                kind={kind}
                placeholder={defaultComboLabel(combo.op, labelOf(combo.a), labelOf(combo.b))}
                defaultIcon="hash"
                color={colors?.[combo.key]}
                onChange={patch => updateCombo(combo.key, patch)}
              />
            </ItemChip>
          ))}
          <MetricPicker entries={pickable.map(p => p.entry)} disabled={atLimit} onPick={pickMetric} />
          {view.metrics.length >= 2 && (
            <CombineMenu
              ops={comboStarts.map(c => c.op)}
              disabledReason={
                splitBlocksCombos
                  ? "Combinations can't be split into series. Remove the split to combine metrics."
                  : comboStarts.length === 0
                    ? 'These metrics have different units, so they can’t be combined.'
                    : undefined
              }
              onPick={op => {
                const combo = comboStarts.find(c => c.op === op);
                if (combo) set(withCombo(combo));
              }}
            />
          )}
        </div>
        {atLimit && (
          <Txt variant="caption" tone="muted">
            A view holds {MAX_METRICS_PER_VIEW} metrics at most. Add another view for more.
          </Txt>
        )}
      </Section>

      {!empty && (
        <Section title="Filters">
          <ViewFilters
            view={view}
            entry={shownEntries[0]}
            hasScores={hasScores}
            onChange={filters => set({ filters })}
          />
        </Section>
      )}

      {split && !empty && (
        <Section title={split}>
          <SplitBy
            view={view}
            entry={shownEntries[0]}
            kind={kind}
            hasScores={hasScores}
            fits={fits}
            sortItems={[
              ...view.metrics.map(m => ({ value: m.key, label: labelOf(m.key) })),
              ...view.combos.map(c => ({ value: c.key, label: comboLabel(c) })),
            ]}
            onChange={patch => set(patch)}
          />
        </Section>
      )}
    </div>
  );
}

type SeriesColor = { color: ChartColor; fallback: ChartColor };

function seriesColors(view: ViewDraft) {
  const colors: Record<string, SeriesColor> = {};
  let place = 0;
  for (const item of [...view.metrics, ...view.combos]) {
    const fallback = seriesColor(place++);
    colors[item.key] = { color: item.color ?? fallback, fallback };
  }
  return colors;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <Txt as="h3" variant="subheading" tone="ink">
        {title}
      </Txt>
      {children}
    </section>
  );
}

type ItemChipProps = {
  label: string;
  /** The series color, when the chart draws one per item. */
  color: ChartColor | undefined;
  onRemove: () => void;
  /** The item's settings, in the chip's popover. */
  children: ReactNode;
};

/** A metric or combination: its mark and label; a click opens its settings. */
function ItemChip({ label, color, onRemove, children }: ItemChipProps) {
  return (
    <span className={chipClass}>
      <Popover>
        <PopoverTrigger
          render={<button type="button" />}
          className={cn(editableSegmentClass, 'text-foreground')}
          aria-label={`${label} settings`}
        >
          <SeriesMark color={color ? chartColor(color) : undefined} />
          <span className="truncate">{label}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-80 flex-col gap-4">
          {children}
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        title={`Remove ${label}`}
        className={removeSegmentClass}
        onClick={onRemove}
      >
        <XIcon />
      </button>
    </span>
  );
}

function AggregationSelect({
  options,
  value,
  onChange,
}: {
  options: readonly Aggregation[];
  value: Aggregation;
  onChange: (aggregation: Aggregation) => void;
}) {
  const items = options.map(a => ({ value: a, label: AGGREGATION_LABELS[a] }));
  return (
    <Field>
      <FieldLabel>Aggregation</FieldLabel>
      <Select value={value} onValueChange={v => v && onChange(v)} items={items}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(i => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

type ComboOperandsProps = {
  combo: CombineDraft;
  options: { value: string; label: string }[];
  /** Whether the combination, patched, still draws. */
  fits: (patch: Partial<CombineDraft>) => boolean;
  onChange: (patch: Partial<CombineDraft>) => void;
};

function ComboOperands({ combo, options, fits, onChange }: ComboOperandsProps) {
  const op = COMBINE_OPS.find(o => o.value === combo.op);
  const opItems = COMBINE_OPS.filter(o => o.value === combo.op || fits({ op: o.value })).map(o => ({
    value: o.value,
    label: o.label,
  }));
  const operand = (side: 'a' | 'b') => {
    const items = options.filter(o => o.value === combo[side] || fits({ [side]: o.value }));
    return (
      <Field>
        <FieldLabel>{side.toUpperCase()}</FieldLabel>
        <Select value={combo[side]} onValueChange={value => value && onChange({ [side]: value })} items={items}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  };
  return (
    <>
      <Field>
        <FieldLabel>Formula</FieldLabel>
        <Select value={combo.op} onValueChange={value => value && onChange({ op: value })} items={opItems}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opItems.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Txt variant="caption" tone="muted">
          {op?.description}
        </Txt>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {operand('a')}
        {operand('b')}
      </div>
    </>
  );
}

type PresentationProps = {
  draft: MetricDraft | CombineDraft;
  kind: EditorKind;
  placeholder: string;
  defaultIcon: KpiIcon;
  /** Set when the item draws as its own series. */
  color: SeriesColor | undefined;
  onChange: (patch: Partial<MetricDraft & CombineDraft>) => void;
};

/** How the item reads in the widget: label, color, icon, direction. */
function Presentation({ draft, kind, placeholder, defaultIcon, color, onChange }: PresentationProps) {
  if (kind === 'scores') return null;
  const labelName = isTimeseriesKind(kind) ? 'Series label' : kind === 'table' ? 'Column label' : 'Tile label';
  return (
    <>
      <Field>
        <FieldLabel>{labelName}</FieldLabel>
        <Input
          size="sm"
          value={draft.label ?? ''}
          placeholder={placeholder}
          onChange={e => onChange({ label: e.target.value || undefined })}
        />
      </Field>
      {color && (
        <ColorSelect
          value={color.color}
          onChange={next => onChange({ color: next === color.fallback ? undefined : next })}
        />
      )}
      {kind === 'kpis' && <IconSelect value={draft.icon ?? defaultIcon} onChange={icon => onChange({ icon })} />}
      {(kind === 'kpis' || kind === 'table') && (
        <Field orientation="horizontal">
          <Switch
            checked={draft.lowerIsBetter ?? false}
            onCheckedChange={checked => onChange({ lowerIsBetter: checked || undefined })}
          />
          <FieldLabel>Lower is better</FieldLabel>
        </Field>
      )}
    </>
  );
}

type MetricPickerProps = {
  /** The catalogue entries the view can take as they stand. */
  entries: CatalogueEntry[];
  disabled?: boolean;
  onPick: (entry: CatalogueEntry) => void;
};

/** The catalogue, grouped, with what the view can't draw left out. */
function MetricPicker({ entries: offered, disabled, onPick }: MetricPickerProps) {
  const groups = METRIC_GROUPS.map(group => ({ value: group, items: offered.filter(e => e.group === group) })).filter(
    g => g.items.length > 0,
  );
  return (
    <ComboboxRoot
      items={groups}
      value={null}
      onValueChange={(entry: CatalogueEntry | null) => entry && onPick(entry)}
      itemToStringLabel={(entry: CatalogueEntry) => entry.label}
      disabled={disabled}
      autoHighlight
    >
      <ComboboxTrigger variant="ghost" size="sm" icon={<PlusIcon />} showChevron={false} className="w-fit">
        Add metric
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxSearch placeholder="Search metrics…" />
        <ComboboxEmpty>No metric matches.</ComboboxEmpty>
        <ComboboxList>
          {(group: (typeof groups)[number], i: number) => (
            <ComboboxGroup key={group.value} items={group.items}>
              {i > 0 ? <ComboboxSeparator /> : null}
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(entry: CatalogueEntry) => (
                  <ComboboxItem key={entry.id} value={entry}>
                    <ComboboxItemContent>
                      <ComboboxItemTitle>{entry.label}</ComboboxItemTitle>
                      <ComboboxItemDescription>{entry.description}</ComboboxItemDescription>
                    </ComboboxItemContent>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </ComboboxRoot>
  );
}

const dimensionsFor = (hasScores: boolean) => DIMENSIONS.filter(d => !(hasScores && d.metricsOnly));

type CombineMenuProps = {
  /** The formulas the view's metrics can take. */
  ops: CombineDraft['op'][];
  /** Set when the view can't hold combinations right now. */
  disabledReason: string | undefined;
  onPick: (op: CombineDraft['op']) => void;
};

/** Adds a preset formula over two of the view's metrics. */
function CombineMenu({ ops, disabledReason, onPick }: CombineMenuProps) {
  if (disabledReason)
    return (
      <HintButton size="sm" variant="ghost" icon={<SigmaIcon />} disabled hint={disabledReason}>
        Combine
      </HintButton>
    );
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button size="sm" variant="ghost" icon={<SigmaIcon />}>
            Combine
          </Button>
        }
      />
      <DropdownMenu.Content align="start">
        {COMBINE_OPS.filter(op => ops.includes(op.value)).map(op => (
          <DropdownMenu.Item key={op.value} onClick={() => onPick(op.value)}>
            <div className="flex flex-col">
              <Txt as="span" variant="body-sm" tone="ink">
                {op.label}
              </Txt>
              <Txt as="span" variant="caption" tone="muted">
                {op.description}
              </Txt>
            </div>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

type ViewFiltersProps = {
  view: ViewDraft;
  /** The metric whose values the value step suggests. */
  entry: CatalogueEntry | undefined;
  hasScores: boolean;
  onChange: (filters: ViewDraft['filters']) => void;
};

/** One `dimension is value` chip per dimension; queries hold one value per dimension. */
function ViewFilters({ view, entry, hasScores, onChange }: ViewFiltersProps) {
  const suggest = useDimensionSuggestions(entry);
  // The split dimension isn't offered: filtering it too would chart its other values as flat lines.
  const fields: FilterBarField[] = dimensionsFor(hasScores).map(d => ({
    id: d.id,
    label: d.label,
    hidden: d.id === view.splitBy,
    suggestions: suggest(d.id),
  }));
  const items: FilterBarItem[] = view.filters.map(f => ({
    id: f.dimension,
    fieldId: f.dimension,
    operatorId: 'is',
    value: f.value,
  }));
  return (
    <FilterBar
      aria-label="View filters"
      fields={fields}
      operators={FILTER_OPERATORS}
      value={items}
      createItemId={fieldId => fieldId}
      onValueChange={(next: FilterBarItem[]) =>
        onChange(next.map(item => ({ dimension: item.fieldId, value: String(item.value) })))
      }
    >
      <FilterBar.Chips />
      <FilterBar.Input placeholder="Filter by environment, agent, model…" />
    </FilterBar>
  );
}

type SplitByProps = {
  view: ViewDraft;
  /** The metric whose values the split's picker lists. */
  entry: CatalogueEntry | undefined;
  kind: EditorKind;
  hasScores: boolean;
  /** Whether the view, patched, still draws every item. */
  fits: (patch: Partial<ViewDraft>) => boolean;
  /** The table's value columns, by key, for its sort. */
  sortItems: { value: string; label: string }[];
  onChange: (patch: Partial<ViewDraft>) => void;
};

function SplitBy({ view, entry, kind, hasScores, fits, sortItems, onChange }: SplitByProps) {
  const timeseries = isTimeseriesKind(kind);
  const { values, isLoading } = useDimensionValues(entry, timeseries ? view.splitBy : undefined);
  const items = [
    { value: NONE, label: kind === 'table' ? 'Pick a dimension' : 'None' },
    // A filtered dimension holds one value, so splitting it would draw a single series.
    ...dimensionsFor(hasScores)
      .filter(
        d =>
          d.id === view.splitBy ||
          (!view.filters.some(f => f.dimension === d.id) && fits({ splitBy: d.id, splitValues: [] })),
      )
      .map(d => ({ value: d.id, label: d.label })),
  ];
  const options = [...new Set([...values, ...view.splitValues])].map(v => ({ value: v, label: v }));
  const blocked = !view.splitBy && !fits({ splitBy: 'environment', splitValues: [] });
  return (
    <div className="flex flex-col gap-3">
      {blocked && (
        <Txt variant="caption" tone="muted">
          Combinations, scores and percentiles can't be split. Remove them to split this view.
        </Txt>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={view.splitBy ?? NONE}
          onValueChange={value => onChange({ splitBy: !value || value === NONE ? undefined : value, splitValues: [] })}
          items={items}
        >
          <SelectTrigger size="sm" aria-label={splitLabel(kind)} className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map(i => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {timeseries && view.splitBy && (
          <Combobox
            multiple
            size="sm"
            className="min-w-48 flex-1"
            aria-label={`${dimensionLabel(view.splitBy)} values`}
            options={options}
            value={view.splitValues}
            onValueChange={splitValues => onChange({ splitValues })}
            placeholder={isLoading ? 'Loading values…' : `Pick ${dimensionLabel(view.splitBy)} values`}
            searchPlaceholder="Search values…"
            emptyText="No values in this range."
          />
        )}
      </div>
      {kind === 'table' && <TableOrder view={view} sortItems={sortItems} onChange={onChange} />}
    </div>
  );
}

function TableOrder({
  view,
  sortItems,
  onChange,
}: {
  view: ViewDraft;
  sortItems: { value: string; label: string }[];
  onChange: (patch: Partial<ViewDraft>) => void;
}) {
  const first = sortItems[0]?.value;
  return (
    <>
      {sortItems.length > 0 && (
        <div className="flex items-end gap-2">
          <Field className="min-w-0 flex-1">
            <FieldLabel>Sort by</FieldLabel>
            <Select
              value={view.sort ?? first ?? null}
              onValueChange={sort => sort && onChange({ sort: sort === first ? undefined : sort })}
              items={sortItems}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortItems.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <SegmentedControl
            aria-label="Sort direction"
            size="sm"
            value={view.sortDirection}
            onValueChange={sortDirection => onChange({ sortDirection })}
          >
            <SegmentedControlItem value="desc">Highest first</SegmentedControlItem>
            <SegmentedControlItem value="asc">Lowest first</SegmentedControlItem>
          </SegmentedControl>
        </div>
      )}
      <Field orientation="horizontal">
        <Switch checked={view.compare} onCheckedChange={compare => onChange({ compare })} />
        <FieldLabel>Compare to previous period</FieldLabel>
      </Field>
    </>
  );
}

function ColorSelect({ value, onChange }: { value: ChartColor; onChange: (color: ChartColor) => void }) {
  return (
    <Field>
      <FieldLabel>Color</FieldLabel>
      <Select value={value} onValueChange={color => color && onChange(color)} items={COLOR_ITEMS}>
        <SelectTrigger size="sm">
          <SeriesMark color={chartColor(value)} />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COLOR_ITEMS.map(c => (
            <SelectItem key={c.value} value={c.value}>
              <SeriesMark color={chartColor(c.value)} />
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function IconSelect({ value, onChange }: { value: KpiIcon; onChange: (icon: KpiIcon) => void }) {
  return (
    <Field>
      <FieldLabel>Icon</FieldLabel>
      <Select value={value} onValueChange={icon => icon && onChange(icon)} items={KPI_ICONS}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {KPI_ICONS.map(i => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
