import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { DialogBody } from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ChevronLeft, Link2 } from 'lucide-react';
import { useState } from 'react';

import { useDisconnectConnection } from '../hooks/use-disconnect-connection';
import { titleize } from './titleize';
import { useDebouncedConnectionRename } from './use-debounced-connection-rename';

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

export const ManageConnectionForm = ({
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
  const rename = useDebouncedConnectionRename({ providerId, connectionId, initialLabel });
  const disconnectConnection = useDisconnectConnection();
  const [draft, setDraft] = useState(initialLabel);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const integrationName = titleize(providerId);

  const disconnect = () => {
    disconnectConnection.mutate(
      { providerId, connectionId, force: true },
      {
        onSuccess: () => {
          toast.success('Connection disconnected');
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
            className="text-neutral3 -mt-1 -ml-1.5 w-fit"
          >
            <Icon>
              <ChevronLeft />
            </Icon>
            Connections
          </Button>
        )}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="bg-surface4 grid size-14 place-items-center overflow-hidden rounded-xl" aria-hidden>
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
                onChange={event => {
                  setDraft(event.target.value);
                  rename.scheduleRename(event.target.value);
                }}
                disabled={disabled || rename.isPending}
                placeholder="Unnamed connection"
                autoFocus
                aria-label="Connection name"
                testId={`${testIdPrefix}-input`}
                className="text-center"
              />
              {rename.isPending && (
                <span className="absolute top-1/2 right-2 -translate-y-1/2">
                  <Spinner size="sm" aria-label="Saving" data-testid={`${testIdPrefix}-saving`} />
                </span>
              )}
            </div>
            {rename.error ? (
              <Txt variant="ui-xs" className="text-red-500">
                {String(rename.error)}
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
