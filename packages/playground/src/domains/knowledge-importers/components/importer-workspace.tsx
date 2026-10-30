import type { KnowledgeImporterSummary } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Eye, Play } from 'lucide-react';
import { useState } from 'react';
import { parseCron, scheduleChoice, SCHEDULE_PRESETS } from '../schedule';
import type { ScheduleChoice } from '../schedule';
import {
  connectionGate,
  draftFromSettings,
  draftToSettings,
  isDraftDirty,
  isForbiddenError,
  READ_ONLY_NOTE,
  readApiError,
} from '../settings';
import type { ImporterDraft } from '../settings';
import {
  isRunActive,
  useImporterCanWrite,
  useImporterConnections,
  useImporterRun,
  useImporterRuns,
  useImporterSummaries,
  useResetImporterSettings,
  useSaveImporterSettings,
  useStartImporterRun,
} from '../use-knowledge-importers';
import { ConnectionField } from './connection-field';
import { ImportNowDialog } from './import-now-dialog';
import { ImporterHeader } from './importer-header';
import { OptionFields } from './option-fields';
import { PreviewPanel } from './preview-panel';
import { RunHistory } from './run-history';
import { SaveBar } from './save-bar';
import { ScheduleControl } from './schedule-control';

/** The editable detail pane for a connected importer: preview, what, when, activity — one draft, one save bar. */
export function ImporterWorkspace({ summary }: { summary: KnowledgeImporterSummary }) {
  const { importerId, settings } = summary;
  const [draft, setDraft] = useState<ImporterDraft>(() => draftFromSettings(settings));
  const [baseVersion, setBaseVersion] = useState(settings.version);
  const [customPinned, setCustomPinned] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string>();

  const summaries = useImporterSummaries();
  const connections = useImporterConnections(importerId, true);
  const runs = useImporterRuns(importerId);
  const activeRun = useImporterRun(importerId, activeRunId);
  const save = useSaveImporterSettings(importerId);
  const reset = useResetImporterSettings(importerId);
  const startRun = useStartImporterRun(importerId);
  const canWrite = useImporterCanWrite();

  // A 403 on any write means the list's canWrite was stale; trust the server.
  const readOnly =
    !canWrite || isForbiddenError(save.error) || isForbiddenError(reset.error) || isForbiddenError(startRun.error);
  const gate = connectionGate(summary.connection, draft.connectionId);
  const blocked = gate.kind === 'disabled' ? gate.reason : undefined;
  const dirty = isDraftDirty(draft, settings);
  const saving = save.isPending || reset.isPending;

  const defaultCron = settings.schedule === null ? (summary.effectiveSchedule ?? '') : '';
  const cron = draft.schedule.trim() || defaultCron;
  const choice = scheduleChoice(draft.enabled, cron, customPinned);
  const scheduleProblem = describeScheduleProblem(choice, cron);

  const running =
    startRun.isPending ||
    (activeRunId !== undefined && (!activeRun.data || isRunActive(activeRun.data))) ||
    (summary.lastRun !== null && isRunActive(summary.lastRun));
  const lastPreview = runs.data?.find(run => run.kind === 'dry-run' && !isRunActive(run));
  const accountName =
    summary.connection.accountName ??
    connections.data?.find(connection => connection.id === summary.connection.connectionId)?.accountName;
  const showConnectionField = summary.connection.status === 'ambiguous' || (connections.data?.length ?? 0) > 1;

  const update = (patch: Partial<ImporterDraft>) => setDraft(previous => ({ ...previous, ...patch }));

  const adopt = (next: KnowledgeImporterSummary) => {
    setDraft(draftFromSettings(next.settings));
    setBaseVersion(next.settings.version);
    setCustomPinned(false);
  };

  const choose = (next: ScheduleChoice) => {
    setCustomPinned(next === 'custom');
    if (next === 'off') return update({ enabled: false });
    if (next === 'custom') return update({ enabled: true, schedule: cron });
    update({ enabled: true, schedule: SCHEDULE_PRESETS.find(preset => preset.id === next)?.cron ?? cron });
  };

  const handleSave = () => {
    save.mutate(
      { ...draftToSettings(draft), expectedVersion: baseVersion },
      {
        onSuccess: next => {
          adopt(next);
          toast.success(`${summary.label} settings saved`);
        },
        onError: async error => {
          const { code, status } = readApiError(error);
          if (code !== 'version_conflict' && status !== 409) return;
          const refreshed = await summaries.refetch();
          const latest = refreshed.data?.find(item => item.importerId === importerId);
          if (latest) adopt(latest);
          toast.warning('Someone else changed this — reloaded');
        },
      },
    );
  };

  const handleReset = () =>
    reset.mutate(undefined, {
      onSuccess: next => {
        adopt(next);
        toast.success(`${summary.label} is back on environment defaults`);
      },
    });

  const start = (kind: 'dry-run' | 'run') => {
    setConfirmImport(false);
    setActiveRunId(undefined);
    startRun.mutate(kind === 'dry-run' ? { kind, settings: draftToSettings(draft) } : { kind }, {
      onSuccess: ({ runId }) => setActiveRunId(runId),
    });
  };

  const previewBlocker = blocked ?? (scheduleProblem ? 'Fix the schedule first' : undefined);
  const importBlocker = blocked ?? (dirty ? 'Save or discard your changes first' : undefined);
  const saveError =
    save.error && !readOnly && readApiError(save.error).status !== 409 ? readApiError(save.error).message : undefined;
  const runError = startRun.error && !readOnly ? describeRunError(startRun.error) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <ImporterHeader
        summary={summary}
        accountName={accountName}
        meta={
          !readOnly && settings.source === 'saved' ? (
            <>
              {' · '}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                disabled={saving}
                onClick={handleReset}
              >
                Reset to environment defaults
              </button>
            </>
          ) : null
        }
        actions={
          readOnly ? null : (
            <>
              <Button
                size="sm"
                icon={<Play />}
                disabled={importBlocker !== undefined || running}
                title={importBlocker}
                onClick={() => setConfirmImport(true)}
              >
                Import now
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<Eye />}
                disabled={previewBlocker !== undefined || running}
                title={previewBlocker}
                onClick={() => start('dry-run')}
              >
                Preview import
              </Button>
            </>
          )
        }
      />

      {readOnly ? (
        <Notice variant="info" title={READ_ONLY_NOTE}>
          <Notice.Message>
            You can see these settings and the activity, but not change them or start imports.
          </Notice.Message>
        </Notice>
      ) : null}
      {blocked && !readOnly ? (
        <Notice variant="warning" title="Imports are unavailable">
          <Notice.Message>{blocked}</Notice.Message>
        </Notice>
      ) : null}
      {runError ? (
        <Notice variant="destructive" title="Couldn't start">
          <Notice.Message>{runError}</Notice.Message>
        </Notice>
      ) : null}

      <SectionCard title="Preview" description={dirty ? 'Previews use your unsaved changes.' : undefined}>
        <PreviewPanel
          run={activeRun.data}
          started={activeRunId !== undefined || startRun.isPending}
          lastPreview={lastPreview}
        />
      </SectionCard>

      <SectionCard title="What gets imported">
        <div className="flex flex-col gap-4">
          {showConnectionField ? (
            <ConnectionField
              value={draft.connectionId}
              ambiguous={summary.connection.status === 'ambiguous'}
              connections={connections.data ?? []}
              disabled={readOnly || saving}
              onChange={connectionId => update({ connectionId })}
            />
          ) : null}
          {summary.optionsSchema.length > 0 ? (
            <OptionFields
              schema={summary.optionsSchema}
              values={draft.options}
              saved={settings.options}
              disabled={readOnly || saving}
              onChange={options => update({ options })}
            />
          ) : (
            <Txt variant="body-sm" tone="muted">
              Everything this connection can reach. There is nothing to narrow for {summary.label}.
            </Txt>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Schedule">
        <ScheduleControl
          choice={choice}
          cron={cron}
          usingDefault={draft.schedule.trim() === '' && defaultCron !== ''}
          wasOn={settings.enabled}
          readOnly={readOnly}
          onChoose={choose}
          onCronChange={schedule => update({ schedule })}
        />
      </SectionCard>

      <SectionCard title="Activity">
        <RunHistory importerId={importerId} />
      </SectionCard>

      {saveError ? (
        <Notice variant="destructive" title="Couldn't save">
          <Notice.Message>{saveError}</Notice.Message>
        </Notice>
      ) : null}

      {dirty && !readOnly ? (
        <SaveBar
          saving={save.isPending}
          problem={scheduleProblem}
          onDiscard={() => adopt(summary)}
          onSave={handleSave}
        />
      ) : null}

      <ImportNowDialog
        label={summary.label}
        open={confirmImport}
        lastPreview={lastPreview}
        onOpenChange={setConfirmImport}
        onConfirm={() => start('run')}
      />
    </div>
  );
}

function describeScheduleProblem(choice: ScheduleChoice, cron: string): string | undefined {
  if (choice === 'off') return undefined;
  if (cron === '') return 'Enter a cron expression to save.';
  return parseCron(cron).ok ? undefined : 'Fix the cron expression to save.';
}

function describeRunError(error: unknown): string {
  const { code, message } = readApiError(error);
  if (code === 'run_in_progress') return 'An import is already running for this importer. Wait for it to finish.';
  if (code === 'connection_unavailable') return 'The connection is unavailable. Fix it before importing.';
  return message;
}
