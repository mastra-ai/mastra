import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { dateRangePresetLabel } from '@mastra/playground-ui/components/DateTimeRangePicker';
import { SavedViewEditor, SavedViewTabs, SavedViewUnsavedDialog } from '@mastra/playground-ui/components/SavedViews';
import type { SavedViewsController } from '@mastra/playground-ui/components/SavedViews';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  TracesExplorer,
  useTracesFilterBarFields,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { TRACE_FILTER_BAR_OPERATORS } from '@mastra/playground-ui/domains/traces/trace-filters';
import {
  TRACE_CUSTOM_COLUMN_LABELS,
  TRACE_OPTIONAL_COLUMN_LABELS,
} from '@mastra/playground-ui/domains/traces/trace-list-columns';
import type { TraceViewSettings } from '@mastra/playground-ui/domains/traces/trace-saved-views';
import { formatDateRange } from '@mastra/playground-ui/utils/date-format';
import { isSavedViewsUnavailableError } from '@mastra/react/hooks/saved-views';
import { useContext } from 'react';
import { useBlocker } from 'react-router';
import { TracesSavedViewsContext } from './traces-saved-views-context';

function ViewSettingsSummary({ settings }: { settings: TraceViewSettings }) {
  const timeRange =
    settings.datePreset === 'custom'
      ? (formatDateRange(settings.dateFrom, settings.dateTo) ?? 'Custom range')
      : dateRangePresetLabel(settings.datePreset);
  const columns = [
    ...settings.columns.visibleColumns.map(column => TRACE_OPTIONAL_COLUMN_LABELS[column]),
    ...settings.columns.customColumns.map(column => TRACE_CUSTOM_COLUMN_LABELS[column]),
    ...settings.columns.metadataKeys,
  ];
  const groups = settings.groups.length;
  return (
    <Txt as="span" variant="caption" tone="muted">
      {timeRange} · {settings.sortDirection === 'desc' ? 'Newest first' : 'Oldest first'} ·{' '}
      {columns.length > 0 ? columns.join(', ') : 'Standard columns'}
      {groups > 0 && ` · ${groups} advanced filter${groups === 1 ? '' : 's'}`}
    </Txt>
  );
}

/**
 * The traces toolbar: view tabs (with the view editor) above the filter bar row. The tabs and the
 * leave dialog read the views themselves, so a views change doesn't re-render the filter bar.
 */
export function TracesToolbar() {
  return (
    <>
      <TraceViewTabs />
      <ActionRow>
        <ActionRow.Start>
          <TracesExplorer.FilterBar />
        </ActionRow.Start>
        <ActionRow.End>
          <TracesExplorer.ColumnsMenu />
        </ActionRow.End>
      </ActionRow>
      <LeaveUnsavedViewDialog />
    </>
  );
}

/** Hidden on scoped pages, while views load, and when the server can't serve them (501, or 404 from an older server). */
function TraceViewTabs() {
  const saved = useContext(TracesSavedViewsContext);
  const fields = useTracesFilterBarFields();
  if (!saved || saved.views.isLoading || isSavedViewsUnavailableError(saved.views.loadError)) return null;
  return (
    <SavedViewEditor views={saved.views} storageLabel={null}>
      <SavedViewTabs
        aria-label="Trace views"
        className="min-w-0 flex-1"
        views={saved.views}
        fields={fields}
        operators={TRACE_FILTER_BAR_OPERATORS}
        defaultLabel="All traces"
        newViewSettings={saved.newViewSettings}
        describeSettings={settings => <ViewSettingsSummary settings={settings} />}
        confirmDelete
        confirmUnsavedSwitch
      />
    </SavedViewEditor>
  );
}

function LeaveUnsavedViewDialog() {
  const saved = useContext(TracesSavedViewsContext);
  return saved && <UnsavedViewBlocker views={saved.views} />;
}

/**
 * Asks before leaving the traces page with unsaved view changes, e.g. from the sidebar. Switching
 * views stays on the page, so `SavedViewTabs` asks for that itself.
 */
function UnsavedViewBlocker({ views }: { views: SavedViewsController<TraceViewSettings> }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => views.unsaved && nextLocation.pathname !== currentLocation.pathname,
  );
  return (
    <SavedViewUnsavedDialog
      views={views}
      open={blocker.state === 'blocked'}
      onProceed={() => {
        if (blocker.state === 'blocked') blocker.proceed();
      }}
      onCancel={() => {
        if (blocker.state === 'blocked') blocker.reset();
      }}
    />
  );
}
