import {
  AlertDialog,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Txt,
  toast,
} from '@mastra/playground-ui';
import { useEffect, useRef, useState } from 'react';

import { useDisconnectConnection } from '../hooks/use-disconnect-connection';
import { useUpdateConnection } from '../hooks/use-update-connection';

const LABEL_SAVE_DEBOUNCE_MS = 400;

export interface ManageConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  connectionId: string;
  initialLabel: string;
  disabled?: boolean;
  testIdPrefix: string;
  onDisconnected: (connectionId: string) => void;
}

export const ManageConnectionDialog = ({
  open,
  onOpenChange,
  providerId,
  connectionId,
  initialLabel,
  disabled = false,
  testIdPrefix,
  onDisconnected,
}: ManageConnectionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={`${testIdPrefix}-dialog`} className="w-[22rem]">
        <DialogTitle className="sr-only">Manage connection</DialogTitle>
        <DialogDescription className="sr-only">Rename or disconnect this authorized account.</DialogDescription>
        {open && (
          <ManageConnectionForm
            key={connectionId}
            providerId={providerId}
            connectionId={connectionId}
            initialLabel={initialLabel}
            disabled={disabled}
            testIdPrefix={testIdPrefix}
            onDone={() => onOpenChange(false)}
            onDisconnected={onDisconnected}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

interface ManageConnectionFormProps {
  providerId: string;
  connectionId: string;
  initialLabel: string;
  disabled: boolean;
  testIdPrefix: string;
  onDone: () => void;
  onDisconnected: (connectionId: string) => void;
}

const normalizeLabel = (label: string) => {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const titleize = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const ManageConnectionForm = ({
  providerId,
  connectionId,
  initialLabel,
  disabled,
  testIdPrefix,
  onDone,
  onDisconnected,
}: ManageConnectionFormProps) => {
  const updateConnection = useUpdateConnection();
  const disconnectConnection = useDisconnectConnection();
  const [draft, setDraft] = useState(initialLabel);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const savedLabelRef = useRef(normalizeLabel(initialLabel));
  const normalizedDraft = normalizeLabel(draft);
  const isLabelDirty = normalizedDraft !== savedLabelRef.current;
  const integrationName = titleize(providerId);
  const logoLabel = integrationName.charAt(0) || '•';

  useEffect(() => {
    if (!isLabelDirty) return;
    const timeout = window.setTimeout(() => {
      updateConnection.mutate(
        { providerId, connectionId, label: normalizedDraft },
        {
          onSuccess: () => {
            savedLabelRef.current = normalizedDraft;
            toast.success('Connection renamed');
          },
        },
      );
    }, LABEL_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [connectionId, isLabelDirty, normalizedDraft, providerId, updateConnection]);

  const disconnect = () => {
    disconnectConnection.mutate(
      { providerId, connectionId, force: true },
      {
        onSuccess: () => {
          toast.success('Connection disconnected');
          onDisconnected(connectionId);
          onDone();
        },
      },
    );
  };

  return (
    <>
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border1 bg-surface3 px-4 py-6 text-center">
        <div className="grid size-14 place-items-center rounded-xl bg-surface4" aria-hidden>
          <Txt variant="header-sm" className="font-semibold text-neutral6">
            {logoLabel}
          </Txt>
        </div>

        <div className="flex w-full flex-col items-center gap-2">
          <Txt variant="ui-xs" className="text-neutral3">
            {integrationName} connection
          </Txt>
          <input
            id={`${testIdPrefix}-input`}
            type="text"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            disabled={disabled || updateConnection.isPending}
            placeholder="Unnamed connection"
            autoFocus
            aria-label="Connection name"
            data-testid={`${testIdPrefix}-input`}
            className="w-full rounded-md border border-border1 bg-surface4 px-2 py-1.5 text-center text-ui-sm text-neutral6 outline-none placeholder:text-neutral3 focus:border-accent1 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {updateConnection.isPending ? (
            <Txt variant="ui-xs" className="text-neutral3">
              Saving…
            </Txt>
          ) : updateConnection.error ? (
            <Txt variant="ui-xs" className="text-red-500">
              {String(updateConnection.error)}
            </Txt>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirmDisconnectOpen(true)}
          disabled={disabled || disconnectConnection.isPending}
          data-testid={`${testIdPrefix}-disconnect`}
        >
          Disconnect
        </Button>
      </div>

      <AlertDialog open={confirmDisconnectOpen} onOpenChange={setConfirmDisconnectOpen}>
        <AlertDialog.Content data-testid={`${testIdPrefix}-disconnect-dialog`}>
          <AlertDialog.Header>
            <AlertDialog.Title>Disconnect connection?</AlertDialog.Title>
            <AlertDialog.Description>
              Disconnecting revokes this authorized account and removes it from Mastra. Agents using this connection will
              lose access. This can’t be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          {disconnectConnection.error ? (
            <Txt variant="ui-xs" className="text-red-500">
              {String(disconnectConnection.error)}
            </Txt>
          ) : null}
          <AlertDialog.Footer>
            <AlertDialog.Cancel data-testid={`${testIdPrefix}-disconnect-cancel`} disabled={disconnectConnection.isPending}>
              Cancel
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant="primary"
              onClick={disconnect}
              disabled={disabled || disconnectConnection.isPending}
              data-testid={`${testIdPrefix}-disconnect-confirm`}
            >
              {disconnectConnection.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
};
