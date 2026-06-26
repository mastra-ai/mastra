import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { useState } from 'react';

import { ManageConnectionForm } from './manage-connection-form';
import { ManageConnectionList } from './manage-connection-list';
import { titleize } from './titleize';

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
