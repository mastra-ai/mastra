import {
  AlertDialog,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Entity,
  EntityContent,
  EntityName,
  Icon,
  Input,
  Spinner,
  Txt,
  toast,
} from '@mastra/playground-ui';
import { ChevronLeft, ChevronRight, Link2, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useDisconnectConnection } from '../hooks/use-disconnect-connection';
import { useUpdateConnection } from '../hooks/use-update-connection';

const LABEL_SAVE_DEBOUNCE_MS = 400;

export interface ManageableConnection {
  connectionId: string;
  label?: string | null;
}

export interface ManageConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  /** Active connections for the toolkit. A single entry skips the list view. */
  connections: ManageableConnection[];
  disabled?: boolean;
  testIdPrefix: string;
  onDisconnected: (connectionId: string) => void;
  /** Backend-provided provider/toolkit icon shown on the rename form. */
  iconUrl?: string;
  /** Adds an "Add connection" action to the list view when provided. */
  onAddConnection?: () => void;
  /** Whether an add-connection request is in flight. */
  addingConnection?: boolean;
}

const titleize = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

export const ManageConnectionDialog = ({
  open,
  onOpenChange,
  providerId,
  connections,
  disabled = false,
  testIdPrefix,
  onDisconnected,
  iconUrl,
  onAddConnection,
  addingConnection = false,
}: ManageConnectionDialogProps) => {
  // Always open on the connection list; selecting an account drills into its
  // rename/disconnect form.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const showList = selectedId === null;
  const selected = connections.find(connection => connection.connectionId === selectedId) ?? null;

  const handleOpenChange = (next: boolean) => {
    if (!next) setSelectedId(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid={`${testIdPrefix}-dialog`} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{showList ? `${titleize(providerId)} connections` : 'Manage connection'}</DialogTitle>
          <DialogDescription>Rename or disconnect this authorized account.</DialogDescription>
        </DialogHeader>
        {open &&
          (showList ? (
            <ManageConnectionList
              connections={connections}
              testIdPrefix={testIdPrefix}
              onSelect={setSelectedId}
              onAddConnection={onAddConnection}
              addingConnection={addingConnection}
              disabled={disabled}
            />
          ) : (
            selected && (
              <ManageConnectionForm
                key={selected.connectionId}
                providerId={providerId}
                connectionId={selected.connectionId}
                initialLabel={selected.label ?? ''}
                iconUrl={iconUrl}
                disabled={disabled}
                testIdPrefix={testIdPrefix}
                showBack
                onBack={() => setSelectedId(null)}
                onDisconnected={connectionId => {
                  onDisconnected(connectionId);
                  // Last account removed → close. Otherwise return to the list so
                  // the dialog reflects the refetched connections.
                  if (connections.length <= 1) {
                    handleOpenChange(false);
                  } else {
                    setSelectedId(null);
                  }
                }}
              />
            )
          ))}
      </DialogContent>
    </Dialog>
  );
};

interface ManageConnectionListProps {
  connections: ManageableConnection[];
  testIdPrefix: string;
  onSelect: (connectionId: string) => void;
  onAddConnection?: () => void;
  addingConnection?: boolean;
  disabled?: boolean;
}

const ManageConnectionList = ({
  connections,
  testIdPrefix,
  onSelect,
  onAddConnection,
  addingConnection = false,
  disabled = false,
}: ManageConnectionListProps) => {
  return (
    <>
      <DialogBody data-testid={`${testIdPrefix}-list`}>
        <div className="flex flex-col gap-2" role="list">
          {connections.map(connection => (
            <Entity
              key={connection.connectionId}
              className="relative items-center rounded-lg px-2 py-2 transition-colors hover:bg-surface4"
            >
              <EntityContent className="min-w-0">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(connection.connectionId)}
                  data-testid={`${testIdPrefix}-list-item-${connection.connectionId}`}
                  className="flex w-full items-center justify-between gap-2 text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-accent1"
                >
                  <EntityName className="truncate">{connection.label?.trim() || 'Unnamed connection'}</EntityName>
                  <Icon className="shrink-0 text-neutral3">
                    <ChevronRight />
                  </Icon>
                </button>
              </EntityContent>
            </Entity>
          ))}
        </div>
      </DialogBody>
      {onAddConnection && (
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddConnection}
            disabled={disabled || addingConnection}
            data-testid={`${testIdPrefix}-add`}
          >
            {addingConnection ? (
              <Spinner size="sm" />
            ) : (
              <Icon>
                <Plus />
              </Icon>
            )}
            Add connection
          </Button>
        </DialogFooter>
      )}
    </>
  );
};

interface ManageConnectionFormProps {
  providerId: string;
  connectionId: string;
  initialLabel: string;
  iconUrl?: string;
  disabled: boolean;
  testIdPrefix: string;
  showBack: boolean;
  onBack: () => void;
  onDisconnected: (connectionId: string) => void;
}

const normalizeLabel = (label: string) => {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ManageConnectionForm = ({
  providerId,
  connectionId,
  initialLabel,
  iconUrl,
  disabled,
  testIdPrefix,
  showBack,
  onBack,
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
          // Parent decides whether to close the dialog or return to the list.
          onDisconnected(connectionId);
        },
      },
    );
  };

  return (
    <>
      <DialogBody className="flex flex-col gap-3">
        {showBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            aria-label="Back to connections"
            data-testid={`${testIdPrefix}-back`}
            className="-mt-1 -ml-1.5 w-fit text-neutral3"
          >
            <Icon>
              <ChevronLeft />
            </Icon>
            Connections
          </Button>
        )}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid size-14 place-items-center overflow-hidden rounded-xl bg-surface4" aria-hidden>
            {iconUrl ? (
              <img src={iconUrl} alt="" className="size-8 object-contain" />
            ) : (
              <Icon size="lg" className="text-neutral3">
                <Link2 />
              </Icon>
            )}
          </div>

          <div className="flex w-full flex-col items-center gap-1.5">
            <Txt variant="ui-xs" className="text-neutral3">
              {integrationName} connection
            </Txt>
            <div className="relative w-full">
              <Input
                id={`${testIdPrefix}-input`}
                variant="filled"
                size="sm"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                disabled={disabled || updateConnection.isPending}
                placeholder="Unnamed connection"
                autoFocus
                aria-label="Connection name"
                testId={`${testIdPrefix}-input`}
                className="text-center"
              />
              {updateConnection.isPending && (
                <span className="absolute top-1/2 right-2 -translate-y-1/2">
                  <Spinner size="sm" aria-label="Saving" data-testid={`${testIdPrefix}-saving`} />
                </span>
              )}
            </div>
            {updateConnection.error ? (
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
      </DialogBody>

      <AlertDialog open={confirmDisconnectOpen} onOpenChange={setConfirmDisconnectOpen}>
        <AlertDialog.Content data-testid={`${testIdPrefix}-disconnect-dialog`}>
          <AlertDialog.Header>
            <AlertDialog.Title>Disconnect connection?</AlertDialog.Title>
            <AlertDialog.Description>
              Disconnecting revokes this authorized account and removes it from Mastra. Agents using this connection
              will lose access. This can’t be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          {disconnectConnection.error ? (
            <Txt variant="ui-xs" className="text-red-500">
              {String(disconnectConnection.error)}
            </Txt>
          ) : null}
          <AlertDialog.Footer>
            <AlertDialog.Cancel
              data-testid={`${testIdPrefix}-disconnect-cancel`}
              disabled={disconnectConnection.isPending}
            >
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
