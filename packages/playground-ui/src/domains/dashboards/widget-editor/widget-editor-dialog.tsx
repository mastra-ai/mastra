import type { DashboardDefinition, DashboardQuery, DashboardWidget } from '@mastra/client-js';
import { DASHBOARD_MAX_WIDGETS } from '@mastra/core/storage/dashboards';
import { CircleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useMetricsFilters } from '../../metrics/hooks/use-metrics-filters';
import { useScorers } from '../hooks/use-scorers';
import type { DashboardScope } from '../lib/definition';
import type { Scorer } from '../lib/scores';
import { EDITOR_KINDS, findEntry, isTimeseriesKind } from './catalogue';
import type { EditorKind } from './catalogue';
import { draftToWidget, effectiveKind, misfit, widgetToDraft } from './codec';
import { copyLabel, defaultSpan, emptyView, emptyWidget, newWidgetTitle, nextViewLabel, unsplit } from './draft';
import type { WidgetDraft } from './draft';
import { TitleInput } from './title-input';
import { ViewEditor } from './view-editor';
import { ViewTabs } from './view-tabs';
import { WidgetPreview } from './widget-preview';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { Form } from '@/ds/components/Form';
import { Notice } from '@/ds/components/Notice';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';
import { Txt } from '@/ds/components/Txt';

export type WidgetEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dashboard the widget belongs to; read only. */
  definition: DashboardDefinition;
  /** The widget to edit; absent to create one. */
  widgetId?: string;
  /** The scope the preview draws at. Saved widgets carry no scope, so they show at both. */
  scope: DashboardScope;
  /** The page inserts the widget, or replaces the one with its id. */
  onSave: (widget: DashboardWidget) => void;
};

/** Creates or edits one widget on a single screen: the form on the left, the widget drawn live on the right. */
export function WidgetEditorDialog({
  open,
  onOpenChange,
  definition,
  widgetId,
  scope,
  onSave,
}: WidgetEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full">
        <WidgetEditor
          key={widgetId ?? 'new'}
          definition={definition}
          widgetId={widgetId}
          scope={scope}
          onSave={widget => {
            onSave(widget);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Any score query without a scorer lists the scorers that scored lately. */
const DISCOVER_SCORERS: DashboardQuery[] = [{ source: 'scores', request: 'aggregate', aggregation: 'avg' }];

function useEditorScorers(): Scorer[] {
  const { filters, timestamp } = useMetricsFilters();
  return useScorers(DISCOVER_SCORERS, { window: timestamp, filters }).scorers;
}

type WidgetEditorProps = Omit<WidgetEditorDialogProps, 'open' | 'onOpenChange'>;

function WidgetEditor({ definition, widgetId, scope, onSave }: WidgetEditorProps) {
  const scorers = useEditorScorers();
  const widgets = definition.rows.flatMap(row => row.widgets);
  const editing = widgetId === undefined ? undefined : widgets.find(w => w.id === widgetId);
  // Decoded once: the form owns the draft from here on.
  const [initial] = useState(() =>
    editing ? widgetToDraft(editing, scorers) : emptyWidget(newWidgetTitle(widgets.map(w => w.title))),
  );

  if (!initial) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Edit widget</DialogTitle>
          <DialogDescription>{editing?.title ?? widgetId}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Notice variant="info" title="This widget can't be edited here">
            {editing
              ? 'It uses settings this editor has no fields for. You can still resize and move it in layout mode.'
              : 'No widget on this dashboard has this id.'}
          </Notice>
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Close</DialogCancel>
        </DialogFooter>
      </>
    );
  }

  return (
    <WidgetEditorForm
      initial={initial}
      creating={!editing}
      takenIds={widgets.map(w => w.id)}
      scorers={scorers}
      scope={scope}
      onSave={onSave}
    />
  );
}

type WidgetEditorFormProps = {
  initial: WidgetDraft;
  creating: boolean;
  /** Ids already on the dashboard. */
  takenIds: string[];
  scorers: Scorer[];
  scope: DashboardScope;
  onSave: (widget: DashboardWidget) => void;
};

function WidgetEditorForm({ initial, creating, takenIds, scorers, scope, onSave }: WidgetEditorFormProps) {
  const methods = useForm<WidgetDraft>({ defaultValues: initial });
  const { control, register, setValue } = methods;
  const draft = useWatch({ control }) as WidgetDraft;
  const [active, setActive] = useState(0);
  const [triedSave, setTriedSave] = useState(false);

  const kind: EditorKind = effectiveKind(draft, scorers);
  const encoded = draftToWidget({ ...draft, kind, span: creating ? defaultSpan(kind) : draft.span }, scorers);
  const activeView = encoded.views[active];

  const issues = [...encoded.issues];
  if (creating && takenIds.length >= DASHBOARD_MAX_WIDGETS)
    issues.unshift(`A dashboard holds ${DASHBOARD_MAX_WIDGETS} widgets at most.`);
  if (creating && takenIds.includes(draft.id)) issues.unshift('Another widget has this id.');

  const hasScore = draft.views.some(v => v.metrics.some(m => findEntry(m.entry, scorers)?.source === 'scores'));
  // Switching kinds drops the split, so a kind is judged on the views without it. One that would
  // still leave a metric out isn't offered: switching never strikes items through.
  const unsplitViews = draft.views.map(unsplit);
  const kinds = EDITOR_KINDS.filter(k => k.value !== 'scores' || hasScore || kind === 'scores').map(k => ({
    ...k,
    misfit: misfit(k.value === kind ? draft.views : unsplitViews, k.value, scorers),
  }));
  const hasMetrics = draft.views.some(v => v.metrics.length > 0);

  const views = draft.views;
  const setViews = (next: WidgetDraft['views']) => setValue('views', next, { shouldDirty: true });

  return (
    <FormProvider {...methods}>
      <Form
        onSubmit={event => {
          event.preventDefault();
          setTriedSave(true);
          if (encoded.widget && issues.length === 0) onSave(encoded.widget);
        }}
      >
        {/* The kind is the widget's, shared by every view: it sits with the title, above the tabs. */}
        <DialogHeader className="flex-row items-center gap-3 pt-0 pr-12 pb-3">
          <DialogTitle className="sr-only">{creating ? 'Add widget' : 'Edit widget'}</DialogTitle>
          <div className="min-w-0 flex-1">
            <TitleInput
              aria-label="Widget title"
              placeholder="Untitled widget"
              aria-invalid={triedSave && !draft.title.trim() ? true : undefined}
              {...register('title')}
            />
          </div>
          {hasMetrics && !draft.kindPicked && (
            <Txt variant="caption" tone="muted">
              Suggested for these metrics
            </Txt>
          )}
          <SegmentedControl
            aria-label="Widget kind"
            size="sm"
            value={kind}
            onValueChange={value => {
              if (value === kind) return;
              setValue('views', unsplitViews, { shouldDirty: true });
              setValue('kind', value, { shouldDirty: true });
              setValue('kindPicked', true, { shouldDirty: true });
            }}
          >
            {kinds.map(k => (
              <SegmentedControlItem
                key={k.value}
                value={k.value}
                disabled={!!k.misfit && k.value !== kind}
                title={k.misfit}
              >
                {k.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </DialogHeader>
        <DialogBody layout="fill" flush className="gap-0">
          {/* The tabs span the form and the preview: both show the active view. */}
          <div className="border-y border-border px-5 py-3">
            <ViewTabs
              labels={views.map(v => v.label)}
              active={active}
              onActiveChange={setActive}
              onAdd={() => {
                setViews([...views, emptyView(nextViewLabel(views))]);
                setActive(views.length);
              }}
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
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
            <div className="flex min-h-0 flex-col">
              <ScrollArea className="min-h-0 flex-1" mask>
                <ScrollAreaViewport className="h-full">
                  <div className="p-5">
                    <ViewEditor key={active} index={active} kind={kind} scorers={scorers} />
                  </div>
                </ScrollAreaViewport>
              </ScrollArea>
            </div>
            <div className="flex min-h-0 flex-col border-border bg-surface-panel p-5 md:border-l">
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {/* my-auto rather than justify-center: a card taller than the box still scrolls from its top. */}
                <div className="my-auto">
                  <WidgetPreview
                    widget={{
                      id: draft.id,
                      span: draft.span,
                      kind: encoded.widget?.kind ?? kindName(kind),
                      title: draft.title,
                    }}
                    view={activeView?.view}
                    issue={activeView?.issues[0]}
                    scope={scope}
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="border-t border-border pt-3 pb-0">
          {triedSave && issues.length > 0 && (
            <ul className="mr-auto flex flex-col gap-0.5" role="alert">
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
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction type="submit">{creating ? 'Add widget' : 'Save widget'}</DialogAction>
        </DialogFooter>
      </Form>
    </FormProvider>
  );
}

const kindName = (kind: EditorKind) => (isTimeseriesKind(kind) ? 'timeseries' : kind);
