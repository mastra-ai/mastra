import type { AgentVersionLabel, ListAgentVersionsResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useId, useState } from 'react';

import { getAgentVersionLabelError } from '../hooks/agent-version-label-error';
import { useDeleteAgentVersionLabel, useSetAgentVersionLabel } from '../hooks/use-agent-version-labels';
import { useActivateAgentVersion } from '../hooks/use-agent-versions';
import { validateCustomVersionLabel } from './agent-version-label-validation';

type AgentVersionListItem = ListAgentVersionsResponse['versions'][number];

export type AgentVersionLabelRefreshOptions = { throwOnError?: boolean };

type RefreshLabels = (options?: AgentVersionLabelRefreshOptions) => Promise<readonly AgentVersionLabel[]>;
type RefreshVersions = (options?: AgentVersionLabelRefreshOptions) => Promise<string | null>;

type MutationDialogCommonProps = {
  agentId: string;
  versions: readonly AgentVersionListItem[];
  onRefreshLabels: RefreshLabels;
  onRefreshVersions: RefreshVersions;
  onStatus: (message: string) => void;
  disabled?: boolean;
};

function findVersion(versions: readonly AgentVersionListItem[], versionId: string | undefined) {
  return versions.find(version => version.id === versionId);
}

function formatVersion(version: AgentVersionListItem | undefined, versionId?: string): string {
  if (version) return `v${version.versionNumber}`;
  return versionId ? `version ${versionId}` : 'no version';
}

function mutationErrorMessage(error: unknown, fallback: string): string {
  return getAgentVersionLabelError(error)?.message ?? fallback;
}

function isConflict(error: unknown): boolean {
  return getAgentVersionLabelError(error)?.code === 'LABEL_MOVE_CONFLICT';
}

function conflictRefreshErrorMessage(message: string): string {
  return `${message} Studio couldn’t refresh current state. Close this dialog and reopen it before retrying.`;
}

function VersionPicker({
  id,
  value,
  onValueChange,
  versions,
  disabledVersionId,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  versions: readonly AgentVersionListItem[];
  disabledVersionId?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} aria-label="Target version" className="w-full">
        <SelectValue placeholder="Select a version" />
      </SelectTrigger>
      <SelectContent>
        {versions.map(version => (
          <SelectItem key={version.id} value={version.id} disabled={version.id === disabledVersionId}>
            v{version.versionNumber} · {version.changeMessage || 'No change message'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DialogError({ message }: { message?: string }) {
  return message ? (
    <Txt variant="ui-sm" className="text-accent2" role="alert">
      {message}
    </Txt>
  ) : null;
}

export function CreateAgentVersionLabelDialog({
  agentId,
  versions,
  labels,
  onRefreshLabels,
  onRefreshVersions,
  onStatus,
  initialVersionId,
  isRowAction = false,
  disabled = false,
}: MutationDialogCommonProps & {
  labels: readonly AgentVersionLabel[];
  initialVersionId?: string;
  isRowAction?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const mutation = useSetAgentVersionLabel({ agentId });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={isRowAction ? 'ghost' : 'primary'}
            size={isRowAction ? 'xs' : 'sm'}
            disabled={disabled}
            aria-label={
              isRowAction
                ? `Add label here for ${formatVersion(findVersion(versions, initialVersionId), initialVersionId)}`
                : undefined
            }
          >
            {isRowAction ? 'Add label here' : 'Create custom label'}
          </Button>
        }
        disabled={disabled}
      />
      {isOpen ? (
        <CreateAgentVersionLabelDialogContent
          versions={versions}
          labels={labels}
          initialVersionId={initialVersionId}
          isPending={mutation.isPending}
          disabled={disabled}
          onCancel={() => setIsOpen(false)}
          onSubmit={async (label, versionId) => {
            await mutation.mutateAsync({ label, input: { versionId, expectedRevisionToken: null } });
            await Promise.all([onRefreshLabels(), onRefreshVersions()]);
            const message = `${label} now points to ${formatVersion(findVersion(versions, versionId), versionId)}.`;
            onStatus(message);
            toast.success('Custom label created');
            setIsOpen(false);
          }}
          onConflict={onRefreshLabels}
        />
      ) : null}
    </Dialog>
  );
}

function CreateAgentVersionLabelDialogContent({
  versions,
  labels,
  initialVersionId,
  isPending,
  disabled,
  onCancel,
  onSubmit,
  onConflict,
}: {
  versions: readonly AgentVersionListItem[];
  labels: readonly AgentVersionLabel[];
  initialVersionId?: string;
  isPending: boolean;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (label: string, versionId: string) => Promise<void>;
  onConflict: RefreshLabels;
}) {
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const [label, setLabel] = useState('');
  const [versionId, setVersionId] = useState(initialVersionId ?? versions[0]?.id ?? '');
  const [error, setError] = useState<string>();
  const [conflictLabel, setConflictLabel] = useState<AgentVersionLabel>();
  const [conflictName, setConflictName] = useState<string>();
  const [conflictStateAvailable, setConflictStateAvailable] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const handleSubmit = async () => {
    const validation = validateCustomVersionLabel(
      label,
      labels.map(existingLabel => existingLabel.name),
    );
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    if (!versionId) {
      setError('Select a target version.');
      return;
    }

    setError(undefined);
    try {
      await onSubmit(label, versionId);
    } catch (mutationError) {
      if (isConflict(mutationError)) {
        const conflictMessage = mutationErrorMessage(mutationError, 'Couldn’t create the custom label.');
        setConflictName(label);
        setConflictLabel(undefined);
        setConflictStateAvailable(false);
        setReviewed(false);
        try {
          const refreshed = await onConflict({ throwOnError: true });
          setConflictLabel(refreshed.find(existingLabel => existingLabel.name === label));
          setConflictStateAvailable(true);
        } catch {
          setError(conflictRefreshErrorMessage(conflictMessage));
          return;
        }
      }
      setError(mutationErrorMessage(mutationError, 'Couldn’t create the custom label.'));
    }
  };

  const conflictApplies = conflictName === label;
  const canRetryConflict = conflictApplies && conflictStateAvailable && !conflictLabel && reviewed;
  const conflictBlocksSubmit = conflictApplies && !canRetryConflict;
  const formattedTarget = formatVersion(findVersion(versions, versionId), versionId);
  const createAccessibleName = `${isPending ? 'Creating' : canRetryConflict ? 'Try creating' : 'Create'} ${label || 'custom label'} for ${formattedTarget}`;

  return (
    <DialogContent aria-busy={isPending}>
      <DialogHeader>
        <DialogTitle>Create custom label</DialogTitle>
        <DialogDescription>Create a named pointer to an existing immutable version.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <Txt variant="ui-sm">Create a pointer to an existing version. No agent version is created.</Txt>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-ui-sm text-neutral5">
            Label name
          </label>
          <Input
            id={inputId}
            value={label}
            onChange={event => setLabel(event.target.value)}
            aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
            error={Boolean(error)}
            autoFocus
          />
          <Txt id={helpId} variant="ui-xs">
            Lowercase ASCII only; 1–64 characters. The value is used exactly as entered.
          </Txt>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${inputId}-version`} className="text-ui-sm text-neutral5">
            Target version
          </label>
          <VersionPicker id={`${inputId}-version`} value={versionId} onValueChange={setVersionId} versions={versions} />
        </div>
        {conflictApplies ? (
          <div className="border-border1 bg-surface3 flex flex-col gap-2 rounded-lg border p-3" role="status">
            <Txt variant="ui-sm">
              {!conflictStateAvailable
                ? `Studio couldn’t refresh the current state for ${label}. Close this dialog and reopen it before retrying.`
                : conflictLabel
                  ? `${label} was created by someone else and currently targets v${conflictLabel.versionNumber}. Choose a different name or close this dialog.`
                  : `${label} is currently available. Review this refreshed state before trying again.`}
            </Txt>
            {conflictStateAvailable && !conflictLabel ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                aria-label={`Review current state for ${label} targeting ${formattedTarget}`}
                onClick={() => setReviewed(true)}
                disabled={reviewed}
              >
                {reviewed ? 'Current state reviewed' : 'Review current state'}
              </Button>
            ) : null}
          </div>
        ) : null}
        <div id={errorId}>
          <DialogError message={error} />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          aria-label={createAccessibleName}
          onClick={() => void handleSubmit()}
          disabled={disabled || isPending || conflictBlocksSubmit}
        >
          {isPending ? 'Creating…' : canRetryConflict ? 'Try again' : 'Create label'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function MoveAgentVersionLabelDialog({
  agentId,
  label,
  versions,
  onRefreshLabels,
  onRefreshVersions,
  onStatus,
  disabled = false,
}: MutationDialogCommonProps & { label: AgentVersionLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const mutation = useSetAgentVersionLabel({ agentId });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="default"
            size="xs"
            disabled={disabled}
            aria-label={`Move ${label.name} from v${label.versionNumber}`}
          >
            Move
          </Button>
        }
        disabled={disabled}
      />
      {isOpen ? (
        <MoveAgentVersionLabelDialogContent
          label={label}
          versions={versions}
          isPending={mutation.isPending}
          disabled={disabled}
          onCancel={() => setIsOpen(false)}
          onRefreshLabels={onRefreshLabels}
          onSubmit={async (versionId, observedLabel) => {
            if (!observedLabel.revisionToken) throw new Error('This label has no revision token. Refresh and retry.');
            await mutation.mutateAsync({
              label: observedLabel.name,
              input: { versionId, expectedRevisionToken: observedLabel.revisionToken },
            });
            await Promise.all([onRefreshLabels(), onRefreshVersions()]);
            const message = `${label.name} moved to ${formatVersion(findVersion(versions, versionId), versionId)}.`;
            onStatus(message);
            toast.success('Custom label moved');
            setIsOpen(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function MoveAgentVersionLabelDialogContent({
  label,
  versions,
  isPending,
  disabled,
  onCancel,
  onRefreshLabels,
  onSubmit,
}: {
  label: AgentVersionLabel;
  versions: readonly AgentVersionListItem[];
  isPending: boolean;
  disabled: boolean;
  onCancel: () => void;
  onRefreshLabels: RefreshLabels;
  onSubmit: (versionId: string, observedLabel: AgentVersionLabel) => Promise<void>;
}) {
  const selectId = useId();
  const [versionId, setVersionId] = useState(label.versionId);
  const [observedLabel, setObservedLabel] = useState<AgentVersionLabel | undefined>(label);
  const [error, setError] = useState<string>();
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [conflictStateAvailable, setConflictStateAvailable] = useState(false);

  const handleSubmit = async () => {
    setError(undefined);
    try {
      if (!observedLabel) return;
      await onSubmit(versionId, observedLabel);
    } catch (mutationError) {
      if (isConflict(mutationError)) {
        setNeedsReview(true);
        setReviewed(false);
        setConflictStateAvailable(false);
        setObservedLabel(undefined);
        const conflictMessage = mutationErrorMessage(mutationError, `Couldn’t move ${label.name}.`);
        try {
          const refreshed = await onRefreshLabels({ throwOnError: true });
          const current = refreshed.find(candidate => candidate.name === label.name);
          setObservedLabel(current);
          setConflictStateAvailable(true);
        } catch {
          setError(conflictRefreshErrorMessage(conflictMessage));
          return;
        }
      }
      setError(mutationErrorMessage(mutationError, `Couldn’t move ${label.name}.`));
    }
  };

  const isIdempotent = versionId === observedLabel?.versionId;
  const canSubmit =
    !disabled &&
    Boolean(observedLabel) &&
    !isPending &&
    !isIdempotent &&
    (!needsReview || (conflictStateAvailable && reviewed));
  const formattedCurrentTarget = formatVersion(
    findVersion(versions, observedLabel?.versionId),
    observedLabel?.versionId,
  );
  const formattedNewTarget = formatVersion(findVersion(versions, versionId), versionId);
  const moveAccessibleName = `${needsReview ? 'Try moving' : 'Move'} ${label.name} from ${formattedCurrentTarget} to ${formattedNewTarget}`;

  return (
    <DialogContent aria-busy={isPending}>
      <DialogHeader>
        <DialogTitle>Move {label.name}</DialogTitle>
        <DialogDescription>Move this custom pointer with compare-and-swap protection.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <Txt variant="ui-sm">
          {label.name} currently points to{' '}
          {formatVersion(findVersion(versions, observedLabel?.versionId), observedLabel?.versionId)}. Moving it does not
          create or delete a version.
        </Txt>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="text-ui-sm text-neutral5">
            New target version
          </label>
          <VersionPicker
            id={selectId}
            value={versionId}
            onValueChange={setVersionId}
            versions={versions}
            disabledVersionId={observedLabel?.versionId}
          />
        </div>
        {needsReview ? (
          <div className="border-border1 bg-surface3 flex flex-col gap-2 rounded-lg border p-3" role="status">
            <Txt variant="ui-sm">
              {!conflictStateAvailable
                ? 'The label changed, but Studio couldn’t refresh its current target. Close this dialog and reopen it before retrying.'
                : observedLabel
                  ? `The label changed while this dialog was open. It now targets ${formatVersion(findVersion(versions, observedLabel.versionId), observedLabel.versionId)}.`
                  : 'The label no longer exists. Close this dialog or create it again as a new label.'}
            </Txt>
            <Button
              type="button"
              variant="default"
              size="sm"
              aria-label={`Review current state for ${label.name} at ${formattedCurrentTarget}`}
              onClick={() => setReviewed(true)}
              disabled={reviewed || !conflictStateAvailable || !observedLabel}
            >
              {reviewed ? 'Current state reviewed' : 'Review current state'}
            </Button>
          </div>
        ) : null}
        <DialogError message={error} />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          aria-label={moveAccessibleName}
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
        >
          {isPending ? 'Moving…' : needsReview ? 'Try again' : 'Move label'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function DeleteAgentVersionLabelDialog({
  agentId,
  label,
  versions,
  onRefreshLabels,
  onRefreshVersions,
  onStatus,
  disabled = false,
}: MutationDialogCommonProps & { label: AgentVersionLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const mutation = useDeleteAgentVersionLabel({ agentId });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="destructive-ghost"
            size="xs"
            disabled={disabled}
            aria-label={`Delete ${label.name} from v${label.versionNumber}`}
          >
            Delete
          </Button>
        }
        disabled={disabled}
      />
      {isOpen ? (
        <DeleteAgentVersionLabelDialogContent
          label={label}
          versions={versions}
          isPending={mutation.isPending}
          disabled={disabled}
          onCancel={() => setIsOpen(false)}
          onRefreshLabels={onRefreshLabels}
          onSubmit={async observedLabel => {
            if (!observedLabel.revisionToken) throw new Error('This label has no revision token. Refresh and retry.');
            await mutation.mutateAsync({
              label: observedLabel.name,
              input: { expectedRevisionToken: observedLabel.revisionToken },
            });
            await Promise.all([onRefreshLabels(), onRefreshVersions()]);
            const message = `${label.name} was deleted. ${formatVersion(findVersion(versions, label.versionId), label.versionId)} is preserved.`;
            onStatus(message);
            toast.success('Custom label deleted');
            setIsOpen(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function DeleteAgentVersionLabelDialogContent({
  label,
  versions,
  isPending,
  disabled,
  onCancel,
  onRefreshLabels,
  onSubmit,
}: {
  label: AgentVersionLabel;
  versions: readonly AgentVersionListItem[];
  isPending: boolean;
  disabled: boolean;
  onCancel: () => void;
  onRefreshLabels: RefreshLabels;
  onSubmit: (observedLabel: AgentVersionLabel) => Promise<void>;
}) {
  const [observedLabel, setObservedLabel] = useState<AgentVersionLabel | undefined>(label);
  const [error, setError] = useState<string>();
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [conflictStateAvailable, setConflictStateAvailable] = useState(false);
  const formattedTarget = formatVersion(findVersion(versions, observedLabel?.versionId), observedLabel?.versionId);

  const handleDelete = async () => {
    setError(undefined);
    try {
      if (!observedLabel) return;
      await onSubmit(observedLabel);
    } catch (mutationError) {
      if (isConflict(mutationError)) {
        setNeedsReview(true);
        setReviewed(false);
        setConflictStateAvailable(false);
        setObservedLabel(undefined);
        const conflictMessage = mutationErrorMessage(mutationError, `Couldn’t delete ${label.name}.`);
        try {
          const refreshed = await onRefreshLabels({ throwOnError: true });
          const current = refreshed.find(candidate => candidate.name === label.name);
          setObservedLabel(current);
          setConflictStateAvailable(true);
        } catch {
          setError(conflictRefreshErrorMessage(conflictMessage));
          return;
        }
      }
      setError(mutationErrorMessage(mutationError, `Couldn’t delete ${label.name}.`));
    }
  };

  return (
    <DialogContent aria-busy={isPending}>
      <DialogHeader>
        <DialogTitle>Delete {label.name}?</DialogTitle>
        <DialogDescription>Delete only this custom pointer, not its immutable version.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <Txt variant="ui-sm">
          Delete the {label.name} pointer from{' '}
          {formatVersion(findVersion(versions, observedLabel?.versionId), observedLabel?.versionId)}? The agent version
          is preserved and can still be selected by version ID.
        </Txt>
        {needsReview ? (
          <div className="border-border1 bg-surface3 flex flex-col gap-2 rounded-lg border p-3" role="status">
            <Txt variant="ui-sm">
              {!conflictStateAvailable
                ? 'The label changed, but Studio couldn’t refresh its current target. Close this dialog and reopen it before retrying.'
                : observedLabel
                  ? `The label was recreated or moved. It now targets ${formatVersion(findVersion(versions, observedLabel.versionId), observedLabel.versionId)}.`
                  : 'The label no longer exists, so there is nothing left to delete.'}
            </Txt>
            <Button
              type="button"
              variant="default"
              size="sm"
              aria-label={`Review current state for ${label.name} at ${formattedTarget}`}
              onClick={() => setReviewed(true)}
              disabled={reviewed || !conflictStateAvailable || !observedLabel}
            >
              {reviewed ? 'Current state reviewed' : 'Review current state'}
            </Button>
          </div>
        ) : null}
        <DialogError message={error} />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          aria-label={`${needsReview ? 'Try deleting' : 'Delete'} ${label.name} from ${formattedTarget}`}
          onClick={() => void handleDelete()}
          disabled={disabled || !observedLabel || isPending || (needsReview && (!conflictStateAvailable || !reviewed))}
        >
          {isPending ? 'Deleting…' : needsReview ? 'Try again' : 'Delete label'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function productionActionLabel(
  target: AgentVersionListItem,
  activeVersionId: string | undefined,
  versions: readonly AgentVersionListItem[],
): string {
  if (target.id === activeVersionId) return `v${target.versionNumber} is Production`;
  const activeVersion = findVersion(versions, activeVersionId);
  if (activeVersion && target.versionNumber < activeVersion.versionNumber) {
    return `Roll Back Production to v${target.versionNumber}`;
  }
  return `Promote v${target.versionNumber} to Production`;
}

export function MoveAgentProductionDialog({
  agentId,
  version,
  versions,
  activeVersionId,
  onRefreshVersions,
  onStatus,
  disabled = false,
}: Omit<MutationDialogCommonProps, 'onRefreshLabels'> & {
  version: AgentVersionListItem;
  activeVersionId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const mutation = useActivateAgentVersion({ agentId });
  const actionLabel = productionActionLabel(version, activeVersionId, versions);
  const isCurrent = version.id === activeVersionId;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="default" size="sm" disabled={disabled || isCurrent}>
            {actionLabel}
          </Button>
        }
        disabled={disabled || isCurrent}
      />
      {isOpen ? (
        <MoveAgentProductionDialogContent
          version={version}
          versions={versions}
          activeVersionId={activeVersionId}
          isPending={mutation.isPending}
          disabled={disabled}
          onCancel={() => setIsOpen(false)}
          onRefreshVersions={onRefreshVersions}
          onSubmit={async expectedActiveVersionId => {
            await mutation.mutateAsync({
              versionId: version.id,
              expectedActiveVersionId: expectedActiveVersionId ?? null,
            });
            await onRefreshVersions();
            const message = `${productionActionLabel(version, expectedActiveVersionId, versions)} completed. Production now points to v${version.versionNumber}.`;
            onStatus(message);
            toast.success('Production updated');
            setIsOpen(false);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function MoveAgentProductionDialogContent({
  version,
  versions,
  activeVersionId,
  isPending,
  disabled,
  onCancel,
  onRefreshVersions,
  onSubmit,
}: {
  version: AgentVersionListItem;
  versions: readonly AgentVersionListItem[];
  activeVersionId?: string;
  isPending: boolean;
  disabled: boolean;
  onCancel: () => void;
  onRefreshVersions: RefreshVersions;
  onSubmit: (expectedActiveVersionId?: string) => Promise<void>;
}) {
  const [observedActiveVersionId, setObservedActiveVersionId] = useState(activeVersionId);
  const [error, setError] = useState<string>();
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [conflictStateAvailable, setConflictStateAvailable] = useState(false);
  const actionLabel = productionActionLabel(version, observedActiveVersionId, versions);
  const productionAccessibleName = needsReview ? `Try again: ${actionLabel}` : actionLabel;

  const handleSubmit = async () => {
    setError(undefined);
    try {
      await onSubmit(observedActiveVersionId);
    } catch (mutationError) {
      if (isConflict(mutationError)) {
        setNeedsReview(true);
        setReviewed(false);
        setConflictStateAvailable(false);
        setObservedActiveVersionId(undefined);
        const conflictMessage = mutationErrorMessage(mutationError, 'Couldn’t update Production.');
        try {
          const current = await onRefreshVersions({ throwOnError: true });
          setObservedActiveVersionId(current ?? undefined);
          setConflictStateAvailable(true);
        } catch {
          setError(conflictRefreshErrorMessage(conflictMessage));
          return;
        }
      }
      setError(mutationErrorMessage(mutationError, 'Couldn’t update Production.'));
    }
  };

  return (
    <DialogContent aria-busy={isPending}>
      <DialogHeader>
        <DialogTitle>{actionLabel}</DialogTitle>
        <DialogDescription>Move the Production pointer with compare-and-swap protection.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <Txt variant="ui-sm">
          Production currently points to{' '}
          {formatVersion(findVersion(versions, observedActiveVersionId), observedActiveVersionId)}. This moves the
          Production pointer to v{version.versionNumber}; it does not create a new version.
        </Txt>
        <div className="border-border1 bg-surface3 rounded-lg border p-3">
          <Txt variant="ui-xs">Target change message</Txt>
          <Txt variant="ui-sm">{version.changeMessage || 'No change message'}</Txt>
        </div>
        {needsReview ? (
          <div className="border-border1 bg-surface3 flex flex-col gap-2 rounded-lg border p-3" role="status">
            <Txt variant="ui-sm">
              {conflictStateAvailable ? (
                <>
                  Production changed while this dialog was open. It now points to{' '}
                  {formatVersion(findVersion(versions, observedActiveVersionId), observedActiveVersionId)}.
                </>
              ) : (
                'Production changed, but Studio couldn’t refresh its current target. Close this dialog and reopen it before retrying.'
              )}
            </Txt>
            <Button
              type="button"
              variant="default"
              size="sm"
              aria-label={`Review Production before moving to v${version.versionNumber}`}
              onClick={() => setReviewed(true)}
              disabled={reviewed || !conflictStateAvailable}
            >
              {reviewed ? 'Current state reviewed' : 'Review current state'}
            </Button>
          </div>
        ) : null}
        <DialogError message={error} />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          aria-label={productionAccessibleName}
          onClick={() => void handleSubmit()}
          disabled={
            disabled ||
            isPending ||
            (needsReview && (!conflictStateAvailable || !reviewed)) ||
            version.id === observedActiveVersionId
          }
        >
          {isPending ? 'Updating…' : needsReview ? 'Try again' : actionLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
