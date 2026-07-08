import { Button } from '@mastra/playground-ui/components/Button';
import { DialogBody, DialogFooter } from '@mastra/playground-ui/components/Dialog';
import { Entity, EntityContent, EntityName } from '@mastra/playground-ui/components/Entity';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ChevronRight, Plus } from 'lucide-react';

import type { ManageableConnection } from './manage-connection-dialog';

interface ManageConnectionListProps {
  connections: ManageableConnection[];
  testIdPrefix: string;
  onSelect: (connectionId: string) => void;
  onAddConnection?: () => void;
  addingConnection?: boolean;
  disabled?: boolean;
}

export const ManageConnectionList = ({
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
