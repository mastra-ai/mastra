import type { DashboardDefinition, DashboardQuery, DashboardWidget } from '@mastra/client-js';
import { DASHBOARD_MAX_WIDGETS } from '@mastra/core/storage/dashboards';
import { CircleAlertIcon, ListFilterIcon, PlusIcon, Settings2Icon, XIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { ChartCard, ChartCardHeaderProvider } from '../../metrics/components/chart-card';
import { useMetricsFilters } from '../../metrics/hooks/use-metrics-filters';
import { useScorers } from '../hooks/use-scorers';
import type { DashboardScope } from '../lib/definition';
import type { Scorer } from '../lib/scores';
import { EDITOR_KINDS, findEntry, isTimeseriesKind } from './catalogue';
import type { EditorKind } from './catalogue';
import { draftToWidget, effectiveKind, misfit, widgetToDraft } from './codec';
import { DEFAULT_VIEW_LABEL, copyLabel, emptyView, emptyWidget, newWidgetTitle, nextViewLabel, unsplit } from './draft';
import type { WidgetDraft } from './draft';
import { KindTiles } from './kind-tiles';
import type { WidgetPreset } from './presets';
import { TitleInput } from './title-input';
import { Section, ViewEditor, ViewFilterEditor } from './view-editor';
import { ViewTabs } from './view-tabs';
import { WidgetPreview } from './widget-preview';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Notice } from '@/ds/components/Notice';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type WidgetEditorChange = {
  /** The widget as it would be saved; absent while it can't be. */
  widget: DashboardWidget | undefined;
  /** The width the widget takes, saved or not. */
  span: WidgetDraft['span'];
  /** What stops the widget from saving; empty once it can. */
  issues: string[];
};

export type WidgetEditorProps = {
  /** The dashboard the widget belongs to; read once, when the editor opens. */
  definition: DashboardDefinition;
  /** The widget to edit; an id not on the dashboard yet starts a new widget with it. */
  widgetId: string;
  /** The scope the card draws at. Saved widgets carry no scope, so they show at both. */
  scope: DashboardScope;
  /** Every edit, once on open too. The page decides what to keep and when to stop editing. */
  onChange: (change: WidgetEditorChange) => void;
  /** Adds a "Delete" button on the card's far right. The page removes the widget and stops editing. */
  onRemove?: () => void;
  className?: string;
};

/**
 * Edits one widget as the card it is on the dashboard: the title is renamed in place, and the
 * kind, metrics, filters, split and views sit in the card's settings popover. The card draws live.
 */
export function WidgetEditor({ definition, widgetId, scope, onChange, onRemove, className }: WidgetEditorProps) {
  const scorers = useEditorScorers();
  // Read once: the editor owns the draft from here on, and the page may write each change back.
  const [opened] = useState(() => {
    const widgets = definition.rows.flatMap(row => row.widgets);
    const editing = widgets.find(w => w.id === widgetId);
    const others = widgets.filter(w => w.id !== widgetId);
    const initial = editing
      ? widgetToDraft(editing, scorers)
      : { ...emptyWidget(newWidgetTitle(others.map(w => w.title))), id: widgetId };
    return { initial, creating: !editing, others: others.length };
  });

  return (
    <div
      role="group"
      aria-label={opened.creating ? 'New widget' : `Edit ${opened.initial?.title ?? widgetId}`}
      // An outline outside the card marks it as being edited, without changing its size.
      className={cn('rounded-xl outline-1 outline-offset-4 outline-border-strong outline-dashed', className)}
    >
      {opened.initial ? (
        <WidgetEditorCard
          initial={opened.initial}
          creating={opened.creating}
          others={opened.others}
          scorers={scorers}
          scope={scope}
          onChange={onChange}
          onRemove={onRemove}
        />
      ) : (
        <Notice variant="info" title="This widget can't be edited here">
          It uses settings this editor has no fields for. You can still resize and move it in layout mode.
        </Notice>
      )}
    </div>
  );
}

/** Any score query without a scorer lists the scorers that scored lately. */
const DISCOVER_SCORERS: DashboardQuery[] = [{ source: 'scores', request: 'aggregate', aggregation: 'avg' }];

function useEditorScorers(): Scorer[] {
  const { filters, timestamp } = useMetricsFilters();
  return useScorers(DISCOVER_SCORERS, { window: timestamp, filters }).scorers;
}

type WidgetEditorCardProps = {
  initial: WidgetDraft;
  creating: boolean;
  /** How many other widgets the dashboard holds. */
  others: number;
  scorers: Scorer[];
  scope: DashboardScope;
  onChange: (change: WidgetEditorChange) => void;
  onRemove?: () => void;
};

function WidgetEditorCard({ initial, creating, others, scorers, scope, onChange, onRemove }: WidgetEditorCardProps) {
  const methods = useForm<WidgetDraft>({ defaultValues: initial });
  const { control, register, setValue } = methods;
  const draft = useWatch({ control }) as WidgetDraft;
  const [active, setActive] = useState(0);
  const views = draft.views;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The filters open past the cog too, so they don't cover it.
  const buttons = useRef<HTMLDivElement>(null);

  const kind: EditorKind = effectiveKind(draft, scorers);
  const span = draft.span;
  const encoded = draftToWidget({ ...draft, kind }, scorers);
  const activeView = encoded.views[active];
  const activeEmpty = !views[active] || (views[active].metrics.length === 0 && views[active].combos.length === 0);
  // Picking the first metric or a ready-made widget is done with the popover. Filling the view swaps
  // "Add metric" for the chart, and a popover still closing would lose its trigger and jump to the
  // page's corner. So it closes first, and the pick lands once it's gone; the cog reopens it.
  const afterClose = useRef<() => void>(undefined);
  const fill = (apply: () => void) => {
    afterClose.current = apply;
    setSettingsOpen(false);
  };

  const issues = [...encoded.issues];
  if (creating && others >= DASHBOARD_MAX_WIDGETS)
    issues.unshift(`A dashboard holds ${DASHBOARD_MAX_WIDGETS} widgets at most.`);

  const emit = useEffectEvent(onChange);
  const change = JSON.stringify({ widget: issues.length === 0 ? encoded.widget : undefined, span, issues });
  useEffect(() => emit(JSON.parse(change) as WidgetEditorChange), [change]);

  const hasScore = views.some(v => v.metrics.some(m => findEntry(m.entry, scorers)?.source === 'scores'));
  // Switching kinds drops the split, so a kind is judged on the views without it. One that would
  // still leave a metric out isn't offered: switching never strikes items through.
  const unsplitViews = views.map(unsplit);
  const kinds = EDITOR_KINDS.filter(k => k.value !== 'scores' || hasScore || kind === 'scores').map(k => ({
    ...k,
    misfit: misfit(k.value === kind ? views : unsplitViews, k.value, scorers),
  }));
  // Why the greyed-out kinds are off, once each: Line and Stacked bars often share a reason.
  const blocked = [...new Set(kinds.flatMap(k => (k.misfit && k.value !== kind ? [k.misfit] : [])))];

  const setViews = (next: WidgetDraft['views']) => setValue('views', next, { shouldDirty: true });
  const pickKind = (value: EditorKind) => {
    setValue('views', unsplitViews, { shouldDirty: true });
    setValue('kind', value, { shouldDirty: true });
    setValue('kindPicked', true, { shouldDirty: true });
  };
  // An empty view can take a ready-made widget whole; a title the user hasn't touched follows it.
  const applyPreset = (preset: WidgetPreset) =>
    fill(() => {
      setViews(views.map((v, i) => (i === active ? { ...preset.view(), label: v.label || DEFAULT_VIEW_LABEL } : v)));
      if (draft.title === initial.title) setValue('title', preset.title, { shouldDirty: true });
      // Not pickKind: that drops splits, and the preset's split is part of it.
      setValue('kind', preset.kind, { shouldDirty: true });
      setValue('kindPicked', true, { shouldDirty: true });
    });
  const addView = () => {
    setViews([...views, emptyView(nextViewLabel(views))]);
    // A new view starts empty, so the card shows its setup screen.
    setActive(views.length);
  };

  const titleProps = {
    'aria-label': 'Widget title',
    placeholder: 'Untitled widget',
    'aria-invalid': !draft.title.trim() ? true : undefined,
    ...register('title'),
  };

  // A single view needs no tabs: it's the widget.
  const tabs = views.length > 1 && (
    <ViewTabs
      labels={views.map(v => v.label)}
      active={active}
      onActiveChange={setActive}
      onRename={(index, label) => setViews(views.map((v, i) => (i === index ? { ...v, label } : v)))}
      onDuplicate={index => {
        const source = views[index];
        if (!source) return;
        // Metric keys only need to be unique within a view, so the copy keeps them.
        const copy = { ...structuredClone(source), label: copyLabel(source.label, views) };
        setViews([...views.slice(0, index + 1), copy, ...views.slice(index + 1)]);
        setActive(index + 1);
      }}
      onDelete={index => {
        setViews(views.filter((_, i) => i !== index));
        setActive(Math.max(0, Math.min(active, views.length - 2)));
      }}
    />
  );

  const heading = (
    <div className="flex min-w-0 flex-col gap-2">
      <TitleInput {...titleProps} />
      {tabs}
    </div>
  );

  // KPIs draw as a row of cards with no card around them, and no title on the page. The editor
  // adds nothing the page won't show: the buttons sit on the frame's corner, the title is renamed in
  // the settings.
  const cardless = kind === 'kpis' && activeView?.view !== undefined;
  const filterCount = views[active]?.filters.length ?? 0;
  const buttonCount = (activeEmpty ? 0 : 3) + (onRemove ? 1 : 0);

  return (
    <FormProvider {...methods}>
      {/* The card remounts its header whenever it swaps what it draws (empty, loading, another
          kind), which would pull a popover off its trigger. So the header only keeps the buttons'
          room, and the buttons live on the frame, over that room. */}
      <ChartCardHeaderProvider
        value={{
          heading,
          actions: buttonCount ? (
            <span aria-hidden className={cn('block h-7', BUTTONS_ROOM[buttonCount])} />
          ) : undefined,
        }}
      >
        {/* One settings popover for the whole card: "Add metric" opens it on an empty view, the cog
            once there's a chart, and it stays open across the switch. */}
        <Popover
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onOpenChangeComplete={open => {
            if (open) return;
            afterClose.current?.();
            afterClose.current = undefined;
          }}
        >
          <div className="relative">
            {activeEmpty ? (
              <ChartCard title={draft.title || 'Untitled widget'}>
                <div className="flex h-full items-center justify-center">
                  <PopoverTrigger variant="ghost" size="sm">
                    <PlusIcon />
                    Add metric
                  </PopoverTrigger>
                </div>
              </ChartCard>
            ) : cardless ? (
              <div className="flex flex-col gap-3">
                {tabs}
                <Preview draft={draft} span={span} kind={kind} activeView={activeView} scope={scope} />
              </div>
            ) : (
              <Preview draft={draft} span={span} kind={kind} activeView={activeView} scope={scope} />
            )}
            {buttonCount > 0 && (
              <div
                ref={buttons}
                className={cn('absolute z-10 flex gap-1', cardless ? '-top-3.5 -right-3.5' : 'top-2 right-4')}
              >
                {!activeEmpty && (
                  <>
                    <Button
                      variant={cardless ? 'default' : 'ghost'}
                      size="icon-sm"
                      tooltip="Add tab"
                      aria-label="Add tab"
                      onClick={addView}
                    >
                      <PlusIcon />
                    </Button>
                    <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                      <PopoverTrigger
                        variant={cardless ? 'default' : 'ghost'}
                        size="icon-sm"
                        tooltip={filterCount ? `Filters (${filterCount})` : 'Filters'}
                        aria-label={filterCount ? `Filters, ${filterCount} applied` : 'Filters'}
                        className="relative"
                      >
                        <ListFilterIcon />
                        {filterCount > 0 && (
                          <span
                            aria-hidden
                            className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-foreground text-caption leading-none text-background tabular-nums"
                          >
                            {filterCount}
                          </span>
                        )}
                      </PopoverTrigger>
                      <PopoverContent
                        anchor={buttons}
                        side="right"
                        align="start"
                        sideOffset={8}
                        collisionAvoidance={COLLISION}
                        className="flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-2 p-3"
                      >
                        <Txt as="h3" variant="label" tone="muted">
                          {views.length > 1 ? <>Filters of the {quoted(views[active]?.label ?? '')} tab</> : 'Filters'}
                        </Txt>
                        <ViewFilterEditor key={active} index={active} scorers={scorers} />
                      </PopoverContent>
                    </Popover>
                    <PopoverTrigger
                      variant={cardless ? 'default' : 'ghost'}
                      size="icon-sm"
                      tooltip="Settings"
                      aria-label="Settings"
                    >
                      <Settings2Icon />
                    </PopoverTrigger>
                  </>
                )}
                {onRemove && (
                  <Button
                    variant={cardless ? 'default' : 'ghost'}
                    size="icon-sm"
                    tooltip="Delete"
                    aria-label="Delete"
                    onClick={onRemove}
                  >
                    <XIcon />
                  </Button>
                )}
              </div>
            )}
          </div>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            collisionAvoidance={COLLISION}
            className={cn(
              'flex max-h-(--available-height) w-[min(32rem,calc(100vw-2rem))] flex-col overflow-y-auto',
              activeEmpty ? 'p-0' : 'gap-5 p-4',
            )}
          >
            {activeEmpty ? (
              <ViewEditor
                key={active}
                index={active}
                kind={kind}
                scorers={scorers}
                start={{ kind, onKind: pickKind, onPreset: applyPreset, fill }}
              />
            ) : (
              <>
                {/* The page shows no title for KPIs, so it's named here instead of on the card. */}
                {cardless && (
                  <Section title="Title">
                    <Input size="sm" {...titleProps} />
                  </Section>
                )}
                {/* The kind is the widget's, shared by every view. */}
                <Section title="Type">
                  <KindTiles
                    kinds={kinds.map(k => ({
                      value: k.value,
                      label: k.label,
                      disabled: k.value === kind ? undefined : k.misfit,
                    }))}
                    value={kind}
                    onChange={pickKind}
                  />
                  {blocked.map(reason => (
                    <Txt key={reason} as="p" variant="caption" tone="muted">
                      {reason}
                    </Txt>
                  ))}
                </Section>
                <ViewEditor key={active} index={active} kind={kind} scorers={scorers} />
                <SettingsFooter view={views.length > 1 ? views[active]?.label : undefined} issues={issues} />
              </>
            )}
          </PopoverContent>
        </Popover>
      </ChartCardHeaderProvider>
    </FormProvider>
  );
}

// Room the card header keeps for the buttons over it: 1.75rem each, 0.25rem apart.
const BUTTONS_ROOM: Record<number, string> = { 1: 'w-7', 3: 'w-23', 4: 'w-31' };

// Beside the button, so the card stays in view: on its left when the right has no room, under it
// when neither side has (narrow screens). Never slid over the button.
const COLLISION = { side: 'flip', align: 'shift', fallbackAxisSide: 'end' } as const;

type PreviewProps = {
  draft: WidgetDraft;
  span: WidgetDraft['span'];
  kind: EditorKind;
  activeView: ReturnType<typeof draftToWidget>['views'][number] | undefined;
  scope: DashboardScope;
};

function Preview({ draft, span, kind, activeView, scope }: PreviewProps) {
  return (
    <WidgetPreview
      widget={{ id: draft.id, span, kind: kindName(kind), title: draft.title }}
      view={activeView?.view}
      issue={activeView?.issues[0]}
      scope={scope}
    />
  );
}

type SettingsFooterProps = {
  /** The view being edited, named once the widget has several. */
  view: string | undefined;
  issues: string[];
};

function SettingsFooter({ view, issues }: SettingsFooterProps) {
  if (!view && issues.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      {issues.length > 0 && (
        <ul className="flex flex-col gap-0.5" role="alert">
          {issues.map(issue => (
            <li key={issue} className="flex items-center gap-1.5">
              <CircleAlertIcon className="size-3.5 shrink-0 text-destructive-indicator" />
              <Txt as="span" variant="caption" tone="muted">
                {issue}
              </Txt>
            </li>
          ))}
        </ul>
      )}
      {view && (
        <Txt as="span" variant="caption" tone="muted">
          Editing the {quoted(view)} tab
        </Txt>
      )}
    </div>
  );
}

const quoted = (label: string): ReactNode => <span className="text-foreground">{label}</span>;

const kindName = (kind: EditorKind) => (isTimeseriesKind(kind) ? 'timeseries' : kind);
