import type { KnowledgeImporterSummary } from '@mastra/client-js';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { toast } from '@mastra/playground-ui/utils/toast';
import { FlaskConical, Play, RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';
import { SCHEDULE_PRESETS, describeCron, isFiveFieldCron } from '../schedule';
import {
  AUTOMATIC_CONNECTION,
  connectionGate,
  draftFromSettings,
  draftToSettings,
  isDraftDirty,
  isForbiddenError,
  READ_ONLY_NOTE,
  readApiError,
  STOPS_NEW_IMPORTS_NOTE,
} from '../settings';
import type { ImporterDraft } from '../settings';
import {
  useImporterCanWrite,
  useImporterConnections,
  useImporterSummaries,
  useResetImporterSettings,
  useSaveImporterSettings,
  useStartImporterRun,
} from '../use-knowledge-importers';
import { OptionFields } from './option-fields';
import { RunHistory } from './run-history';
import { RunResult } from './run-result';
import { ConnectionStatusBadge } from './status-badges';

const DEFAULT_SCHEDULE_WORDS = 'the default schedule';

export function ImporterDetail({ summary }: { summary: KnowledgeImporterSummary }) {
  const gate = connectionGate(summary.connection, AUTOMATIC_CONNECTION);

  return (
    <section className="flex flex-col gap-6" aria-labelledby="importer-detail-title">
      <header className="flex flex-wrap items-center gap-3">
        <Txt as="h2" variant="heading" id="importer-detail-title">
          {summary.label}
        </Txt>
        <ConnectionStatusBadge status={summary.connection.status} />
        <Badge variant="neutral" emphasis="subtle" size="sm">
          {summary.settings.source === 'saved' ? 'Saved settings' : 'Environment defaults'}
        </Badge>
        {summary.settings.source === 'saved' && summary.settings.updatedAt ? (
          <Txt as="span" variant="caption" tone="muted">
            Saved{summary.settings.updatedBy ? ` by ${summary.settings.updatedBy}` : ''}{' '}
            <RelativeTimestamp value={summary.settings.updatedAt} />
          </Txt>
        ) : null}
      </header>

      {gate.kind === 'hidden' ? (
        <Notice variant="info" title="Not connected to this project">
          <Notice.Message>
            Link a {summary.label} connection to this project before configuring or running this importer.
          </Notice.Message>
        </Notice>
      ) : (
        <ImporterSettingsForm summary={summary} />
      )}

      <section className="flex flex-col gap-2" aria-labelledby="importer-history-title">
        <Txt as="h3" variant="subheading" id="importer-history-title">
          Run history
        </Txt>
        <RunHistory importerId={summary.importerId} />
      </section>
    </section>
  );
}

const PAUSED = 'paused';

function ImporterSettingsForm({ summary }: { summary: KnowledgeImporterSummary }) {
  const { importerId, settings } = summary;
  const [draft, setDraft] = useState<ImporterDraft>(() => draftFromSettings(settings));
  const [baseVersion, setBaseVersion] = useState(settings.version);
  const [conflict, setConflict] = useState(false);
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [confirmRun, setConfirmRun] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string>();

  const summaries = useImporterSummaries();
  const connections = useImporterConnections(importerId, summary.connection.status !== 'none');
  const save = useSaveImporterSettings(importerId);
  const reset = useResetImporterSettings(importerId);
  const startRun = useStartImporterRun(importerId);
  const canWrite = useImporterCanWrite();

  const gate = connectionGate(summary.connection, draft.connectionId);
  const blocked = gate.kind === 'disabled' ? gate.reason : undefined;
  const dirty = isDraftDirty(draft, settings);
  const scheduleInvalid = draft.schedule.trim() !== '' && !isFiveFieldCron(draft.schedule);
  const busy = save.isPending || reset.isPending;
  // A 403 on any write means the list's canWrite was stale; trust the server.
  const readOnly =
    !canWrite || isForbiddenError(save.error) || isForbiddenError(reset.error) || isForbiddenError(startRun.error);

  const scheduleWords =
    draft.schedule.trim() !== ''
      ? describeCron(draft.schedule)
      : settings.schedule === null && summary.effectiveSchedule
        ? describeCron(summary.effectiveSchedule)
        : DEFAULT_SCHEDULE_WORDS;

  const update = (patch: Partial<ImporterDraft>) => setDraft(previous => ({ ...previous, ...patch }));

  const adopt = (next: KnowledgeImporterSummary) => {
    setDraft(draftFromSettings(next.settings));
    setBaseVersion(next.settings.version);
  };

  const handleSave = () => {
    setConflict(false);
    save.mutate(
      { ...draftToSettings(draft), expectedVersion: baseVersion },
      {
        onSuccess: next => {
          adopt(next);
          toast.success(`${summary.label} settings saved`);
        },
        onError: async error => {
          if (readApiError(error).code !== 'version_conflict' && readApiError(error).status !== 409) return;
          setConflict(true);
          const refreshed = await summaries.refetch();
          const latest = refreshed.data?.find(item => item.importerId === importerId);
          if (latest) adopt(latest);
        },
      },
    );
  };

  const handleReset = () => {
    setConflict(false);
    reset.mutate(undefined, {
      onSuccess: next => {
        adopt(next);
        toast.success(`${summary.label} is back on environment defaults`);
      },
    });
  };

  const start = (kind: 'dry-run' | 'run') => {
    setActiveRunId(undefined);
    startRun.mutate(kind === 'dry-run' ? { kind, settings: draftToSettings(draft) } : { kind }, {
      onSuccess: ({ runId }) => setActiveRunId(runId),
    });
    setConfirmRun(false);
  };

  const presetValue = !draft.enabled
    ? PAUSED
    : (SCHEDULE_PRESETS.find(preset => preset.cron === draft.schedule.trim())?.id ?? undefined);

  const saveError = save.error && !conflict && !readOnly ? readApiError(save.error).message : undefined;
  const runError = startRun.error && !readOnly ? describeRunError(startRun.error) : undefined;

  return (
    <div className="flex flex-col gap-6">
      {conflict ? (
        <Notice variant="warning" title="Someone else changed these settings">
          <Notice.Message>The form now shows the latest saved settings. Review them and save again.</Notice.Message>
        </Notice>
      ) : null}

      {readOnly ? (
        <Notice variant="info" title={READ_ONLY_NOTE}>
          <Notice.Message>
            You can see these settings and run history, but not change them or start runs.
          </Notice.Message>
        </Notice>
      ) : null}

      {blocked && !readOnly ? (
        <Notice variant="warning" title="Runs are unavailable">
          <Notice.Message>{blocked}</Notice.Message>
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field orientation="horizontal">
            <FieldContent className="gap-0.5">
              <FieldLabel>Automatic imports</FieldLabel>
              <FieldDescription className="mt-0">
                {draft.enabled
                  ? `Runs ${scheduleWords === DEFAULT_SCHEDULE_WORDS ? 'on the default schedule' : scheduleWords}.`
                  : 'Off — only manual runs.'}
              </FieldDescription>
            </FieldContent>
            {readOnly ? null : (
              <Switch
                aria-label="Automatic imports"
                checked={draft.enabled}
                disabled={busy || (!draft.enabled && blocked !== undefined)}
                onCheckedChange={checked => (checked ? setConfirmEnable(true) : setConfirmDisable(true))}
              />
            )}
          </Field>

          <Field>
            <FieldLabel>Connection</FieldLabel>
            <Select
              value={draft.connectionId}
              disabled={readOnly}
              onValueChange={value => update({ connectionId: value })}
            >
              <SelectTrigger aria-label="Connection">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTOMATIC_CONNECTION}>
                  {summary.connection.status === 'ambiguous' ? 'Automatic (several linked — choose one)' : 'Automatic'}
                </SelectItem>
                {connections.data?.map(connection => (
                  <SelectItem key={connection.id} value={connection.id}>
                    {connection.accountName || connection.id}
                    {connection.status === 'active' ? '' : ` (${connection.status})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription className="mt-0">
              Automatic uses the one connection linked to this project.
            </FieldDescription>
          </Field>

          <Field invalid={scheduleInvalid}>
            <FieldLabel>Schedule</FieldLabel>
            {readOnly ? null : (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Schedule presets">
                {SCHEDULE_PRESETS.map(preset => (
                  <Button
                    key={preset.id}
                    size="sm"
                    variant={presetValue === preset.id ? 'primary' : 'default'}
                    aria-pressed={presetValue === preset.id}
                    onClick={() => update({ schedule: preset.cron })}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={presetValue === PAUSED ? 'primary' : 'default'}
                  aria-pressed={presetValue === PAUSED}
                  onClick={() => (draft.enabled ? setConfirmDisable(true) : undefined)}
                >
                  Paused
                </Button>
              </div>
            )}
            <Input
              aria-label="Cron expression"
              placeholder={
                summary.effectiveSchedule && settings.schedule === null
                  ? `Default: ${summary.effectiveSchedule}`
                  : 'Default schedule'
              }
              value={draft.schedule}
              disabled={readOnly}
              aria-invalid={scheduleInvalid}
              onChange={event => update({ schedule: event.target.value })}
            />
            {scheduleInvalid ? (
              <FieldError>Use five cron fields, e.g. */15 * * * *</FieldError>
            ) : (
              <FieldDescription className="mt-0">
                {draft.schedule.trim() !== ''
                  ? `${scheduleWords}.`
                  : scheduleWords === DEFAULT_SCHEDULE_WORDS
                    ? 'Empty uses the environment default schedule.'
                    : `Empty uses the default schedule — ${scheduleWords}.`}
              </FieldDescription>
            )}
          </Field>
        </div>

        {summary.optionsSchema.length > 0 ? (
          <OptionFields
            schema={summary.optionsSchema}
            values={draft.options}
            disabled={busy || readOnly}
            onChange={options => update({ options })}
          />
        ) : (
          <Txt variant="body-sm" tone="muted">
            This importer has no options.
          </Txt>
        )}
      </div>

      {saveError ? (
        <Notice variant="destructive" title="Couldn't save">
          <Notice.Message>{saveError}</Notice.Message>
        </Notice>
      ) : null}
      {runError ? (
        <Notice variant="destructive" title="Couldn't start the run">
          <Notice.Message>{runError}</Notice.Message>
        </Notice>
      ) : null}

      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Save />}
            disabled={!dirty || scheduleInvalid || busy}
            onClick={handleSave}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" icon={<RotateCcw />} disabled={settings.source !== 'saved' || busy} onClick={handleReset}>
            Reset to environment
          </Button>
          <span className="flex-1" />
          <Button
            size="sm"
            icon={<FlaskConical />}
            disabled={blocked !== undefined || scheduleInvalid || startRun.isPending}
            title={blocked}
            onClick={() => start('dry-run')}
          >
            Dry run
          </Button>
          <Button
            size="sm"
            icon={<Play />}
            disabled={blocked !== undefined || dirty || startRun.isPending}
            title={blocked ?? (dirty ? 'Save changes first' : undefined)}
            onClick={() => setConfirmRun(true)}
          >
            Run now
          </Button>
        </div>
      )}

      {activeRunId ? <RunResult importerId={importerId} runId={activeRunId} /> : null}

      <AlertDialog open={confirmEnable} onOpenChange={setConfirmEnable}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Turn on automatic imports?</AlertDialog.Title>
            <AlertDialog.Description>
              This starts automatic imports on {scheduleWords} once you save.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <Button
              variant="primary"
              onClick={() => {
                update({ enabled: true });
                setConfirmEnable(false);
              }}
            >
              Turn on
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Turn off automatic imports?</AlertDialog.Title>
            <AlertDialog.Description>{STOPS_NEW_IMPORTS_NOTE} Takes effect once you save.</AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <Button
              variant="primary"
              onClick={() => {
                update({ enabled: false });
                setConfirmDisable(false);
              }}
            >
              Turn off
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>

      <AlertDialog open={confirmRun} onOpenChange={setConfirmRun}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Run {summary.label} now?</AlertDialog.Title>
            <AlertDialog.Description>
              This imports into Knowledge using the saved settings. Use a dry run to preview without writing.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <Button variant="primary" icon={<Play />} onClick={() => start('run')}>
              Run now
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}

function describeRunError(error: unknown): string {
  const { code, message } = readApiError(error);
  if (code === 'run_in_progress') return 'A run is already in progress for this importer. Wait for it to finish.';
  if (code === 'connection_unavailable') return 'The connection is unavailable. Fix it before running.';
  return message;
}
