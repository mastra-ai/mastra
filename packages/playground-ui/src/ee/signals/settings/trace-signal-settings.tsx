import type { TraceSignalDefinition } from '@mastra/client-js';
import { Settings } from 'lucide-react';
import { useState } from 'react';

import { useTraceIntelligence } from '../use-trace-intelligence';
import { SignalDefinitionFormDialog } from './signal-definition-form-dialog';
import { useSignalManagementList, useSignalManagementMutations } from './use-signal-management';
import { Button } from '@/ds/components/Button';
import { DataDetailsPanel } from '@/ds/components/DataDetailsPanel';
import { Notice } from '@/ds/components/Notice';
import { Skeleton } from '@/ds/components/Skeleton';
import { StatusBadge } from '@/ds/components/StatusBadge';
import { Switch } from '@/ds/components/Switch';

export function TraceSignalSettingsButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { signalManagement } = useTraceIntelligence();
  if (!signalManagement) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-md"
      tooltip="Signal settings"
      aria-label="Signal settings"
      aria-controls="trace-signal-settings"
      aria-expanded={open}
      onClick={onClick}
    >
      <Settings aria-hidden="true" />
    </Button>
  );
}

export function TraceSignalSettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside id="trace-signal-settings" aria-label="Trace signal settings" className="min-h-0">
      <DataDetailsPanel>
        <DataDetailsPanel.Header>
          <DataDetailsPanel.Heading className="text-neutral5 items-center font-medium">
            <Settings aria-hidden="true" /> Trace signal settings
          </DataDetailsPanel.Heading>
          <DataDetailsPanel.CloseButton onClick={onClose} tooltip="Close settings" />
        </DataDetailsPanel.Header>
        <DataDetailsPanel.Content>
          <TraceSignalSettingsContent />
        </DataDetailsPanel.Content>
      </DataDetailsPanel>
    </aside>
  );
}

function TraceSignalSettingsContent() {
  const { signalCatalog, signalManagement } = useTraceIntelligence();
  const query = useSignalManagementList();
  const mutations = useSignalManagementMutations();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TraceSignalDefinition>();
  const [actionError, setActionError] = useState<string>();
  const canManage = signalManagement?.canManage ?? false;

  if (query.isPending) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading signal settings">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <Notice variant="destructive">
        <Notice.Message>{query.error?.message ?? 'Failed to load signal settings'}</Notice.Message>
      </Notice>
    );
  }

  const active = query.data.definitions.filter(definition => definition.status === 'active');
  const archived = query.data.definitions.filter(definition => definition.status === 'archived');
  const limit = query.data.limits.maxDefinitionsPerOrganization;
  const atLimit = active.length >= limit;
  const mutationPending = creating ? mutations.create.isPending : mutations.update.isPending;
  const formError = creating ? mutations.create.error?.message : editing ? mutations.update.error?.message : undefined;
  const openCreateForm = () => {
    mutations.create.reset();
    setCreating(true);
  };
  const setCreateFormOpen = (open: boolean) => {
    if (!open) mutations.create.reset();
    setCreating(open);
  };
  const openEditForm = (definition: TraceSignalDefinition) => {
    mutations.update.reset();
    setEditing(definition);
  };
  const closeEditForm = () => {
    mutations.update.reset();
    setEditing(undefined);
  };

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError(undefined);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update signal settings');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="border-border1 grid gap-2 rounded-md border p-3 sm:grid-cols-2">
          <div>
            <p className="text-ui-sm text-neutral4 font-medium">Organization signal library</p>
            <p className="text-ui-xs text-neutral3">Definitions, prompts, and versions are shared by every project.</p>
          </div>
          <div>
            <p className="text-ui-sm text-neutral4 font-medium">Current project</p>
            <p className="text-ui-xs text-neutral3">Enable switches apply only to this project.</p>
          </div>
        </div>
        {!canManage ? (
          <Notice variant="info">
            <Notice.Message>You have read-only access. An organization admin can change these settings.</Notice.Message>
          </Notice>
        ) : null}
        {actionError ? (
          <Notice variant="destructive">
            <Notice.Message>{actionError}</Notice.Message>
          </Notice>
        ) : null}
      </div>

      <section aria-labelledby="built-in-signals-heading">
        <h3 id="built-in-signals-heading" className="text-ui-md text-neutral4 mb-2 font-medium">
          Built-in signals
        </h3>
        <div className="divide-border1 border-border1 divide-y rounded-md border px-3">
          {signalCatalog
            .filter(signal => signal.builtIn)
            .map(signal => (
              <div key={signal.name} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-ui-sm text-neutral4">{signal.label}</p>
                  <p className="text-ui-xs text-neutral3 truncate">{signal.description}</p>
                </div>
                <StatusBadge variant="neutral" size="sm">
                  Read only
                </StatusBadge>
              </div>
            ))}
        </div>
      </section>

      <section aria-labelledby="custom-signals-heading">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="custom-signals-heading" className="text-ui-md text-neutral4 font-medium">
              Custom signals
            </h3>
            <p className="text-ui-xs text-neutral3">
              {active.length} of {limit} active organization definitions
            </p>
          </div>
          <Button size="sm" variant="primary" disabled={!canManage || atLimit} onClick={openCreateForm}>
            Create signal
          </Button>
        </div>
        {atLimit ? (
          <Notice variant="info">
            <Notice.Message>Archive an active definition before creating or restoring another.</Notice.Message>
          </Notice>
        ) : null}
        <div className="divide-border1 divide-y">
          {active.map(definition => (
            <div key={definition.id} className="flex min-h-16 items-center justify-between gap-4 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-ui-sm text-neutral4 truncate">{definition.displayLabel}</span>
                  <StatusBadge variant="neutral" size="sm">
                    v{definition.version}
                  </StatusBadge>
                </div>
                <p className="text-ui-xs text-neutral3 truncate">{definition.description || definition.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="ghost" disabled={!canManage} onClick={() => openEditForm(definition)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={
                    !canManage || (mutations.archive.isPending && mutations.archive.variables === definition.id)
                  }
                  onClick={() => void runAction(() => mutations.archive.mutateAsync(definition.id))}
                >
                  Archive
                </Button>
                <Switch
                  aria-label={`Enable ${definition.displayLabel}`}
                  checked={definition.enabled ?? false}
                  disabled={
                    !canManage ||
                    (mutations.setProjectEnabled.isPending &&
                      mutations.setProjectEnabled.variables?.id === definition.id)
                  }
                  onCheckedChange={enabled =>
                    void runAction(() => mutations.setProjectEnabled.mutateAsync({ id: definition.id, enabled }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
        {active.length === 0 ? <p className="text-ui-sm text-neutral3 py-3">No custom signals yet.</p> : null}
      </section>

      {archived.length > 0 ? (
        <details>
          <summary className="text-ui-sm text-neutral4 cursor-pointer">
            Archived definitions ({archived.length})
          </summary>
          <div className="divide-border1 mt-2 divide-y">
            {archived.map(definition => (
              <div key={definition.id} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <span className="text-ui-sm text-neutral3">{definition.displayLabel}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={
                    !canManage ||
                    atLimit ||
                    (mutations.restore.isPending && mutations.restore.variables === definition.id)
                  }
                  onClick={() => void runAction(() => mutations.restore.mutateAsync(definition.id))}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <p className="text-ui-xs text-neutral3">
        Enabling a signal starts collection for new traces. Entity status shows when enough generated data has been
        processed and clustered.
      </p>

      {creating ? (
        <SignalDefinitionFormDialog
          open
          onOpenChange={setCreateFormOpen}
          pending={mutationPending}
          error={formError}
          onCreate={async input => {
            await mutations.create.mutateAsync(input);
          }}
          onUpdate={async () => undefined}
        />
      ) : null}
      {editing ? (
        <SignalDefinitionFormDialog
          open
          definition={editing}
          onOpenChange={open => {
            if (!open) closeEditForm();
          }}
          pending={mutationPending}
          error={formError}
          onCreate={async () => undefined}
          onUpdate={async (id, input) => {
            await mutations.update.mutateAsync({ id, input });
          }}
        />
      ) : null}
    </div>
  );
}
