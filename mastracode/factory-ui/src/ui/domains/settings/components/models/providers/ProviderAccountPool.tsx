import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ContentBlock, ContentBlocks } from '@mastra/playground-ui/components/ContentBlocks';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Input } from '@mastra/playground-ui/components/Input';
import { Status } from '@mastra/playground-ui/components/StatusIndicators';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { HTMLAttributes } from 'react';

import type { PoolAccountSummary } from '../../../../../../api/types';
import {
  useActivateProviderAccount,
  useProviderAccountsQuery,
  useRemoveProviderAccount,
  useRenameProviderAccount,
  useReorderProviderAccounts,
} from '../../../../../../hooks/use-provider-accounts';
import type { AccountScope } from '../../../../../../hooks/use-provider-accounts';

type DragHandleProps = HTMLAttributes<HTMLElement>;

const ACCOUNT_TYPE_LABEL: Record<PoolAccountSummary['type'], string> = {
  oauth: 'Signed in',
  'api-key': 'Key saved',
};

function cooldownEnd(until: number | undefined): string {
  if (until === undefined) return '';
  return ` until ${new Date(until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function accountStatus(account: PoolAccountSummary): StatusPresentation {
  switch (account.status) {
    case 'cooldown':
      return {
        label: `Cooling down${cooldownEnd(account.cooldownUntil)}`,
        tone: 'neutral',
        description: 'Rate limited; routing skips this account until the cooldown ends',
      };
    case 'auth-failed':
      return {
        label: account.type === 'oauth' ? 'Sign-in failed' : 'Key rejected',
        tone: 'error',
        description: 'The provider rejected this credential; routing skips it',
      };
    case 'ok':
      return { label: 'Ready', tone: 'success', description: 'Available to routing' };
  }
}

function moved(accounts: readonly PoolAccountSummary[], from: number, to: number): string[] {
  const ids = accounts.map(account => account.id);
  const [id] = ids.splice(from, 1);
  if (id !== undefined) ids.splice(to, 0, id);
  return ids;
}

/**
 * The accounts pooled under one connected provider at one scope. Routing tries
 * them in the listed order; `manageable` is false for members viewing the org
 * pool, which shows the pool without its controls.
 */
export function ProviderAccountPool({
  provider,
  displayName,
  scope,
  manageable,
  disabled,
}: {
  provider: string;
  displayName: string;
  scope: AccountScope;
  manageable: boolean;
  disabled: boolean;
}) {
  const accountsQuery = useProviderAccountsQuery(provider, scope);
  const activate = useActivateProviderAccount(provider, scope);
  const rename = useRenameProviderAccount(provider, scope);
  const remove = useRemoveProviderAccount(provider, scope);
  const reorder = useReorderProviderAccounts(provider, scope);
  const [renaming, setRenaming] = useState<PoolAccountSummary>();

  const saved = accountsQuery.data ?? [];
  // A single account is the provider row itself; the pool list starts at two.
  if (saved.length < 2) return null;

  // Show the order being saved so a dropped row does not snap back while the request is in flight.
  const pendingOrder = reorder.isPending ? reorder.variables : undefined;
  const accounts = pendingOrder ? pendingOrder.flatMap(id => saved.find(account => account.id === id) ?? []) : saved;
  const busy = disabled || activate.isPending || remove.isPending || reorder.isPending;

  const saveOrder = (orderedIds: string[]) => {
    if (busy || orderedIds.join('\n') === saved.map(account => account.id).join('\n')) return;
    reorder.mutate(orderedIds, { onError: error => toast.error(error.message || 'Failed to reorder accounts') });
  };

  const renderRow = (account: PoolAccountSummary, index: number, dragHandleProps?: DragHandleProps | null) => (
    <AccountRow
      account={account}
      manageable={manageable}
      disabled={busy}
      dragHandleProps={dragHandleProps}
      onMoveUp={index > 0 ? () => saveOrder(moved(accounts, index, index - 1)) : undefined}
      onMoveDown={index < accounts.length - 1 ? () => saveOrder(moved(accounts, index, index + 1)) : undefined}
      onActivate={() =>
        activate.mutate(account.id, { onError: error => toast.error(error.message || 'Failed to switch account') })
      }
      onRename={() => setRenaming(account)}
      onRemove={() =>
        remove.mutate(account.id, { onError: error => toast.error(error.message || 'Failed to remove account') })
      }
    />
  );

  return (
    <div className="flex flex-col gap-1 pb-1.5 pl-9" role="group" aria-label={`${displayName} accounts`}>
      {manageable ? (
        <ContentBlocks
          items={accounts}
          onChange={next => saveOrder(next.map(account => account.id))}
          className="flex min-w-0 flex-col"
        >
          {accounts.map((account, index) => (
            <ContentBlock key={account.id} draggableId={account.id} index={index}>
              {dragHandleProps => renderRow(account, index, dragHandleProps)}
            </ContentBlock>
          ))}
        </ContentBlocks>
      ) : (
        <div className="flex min-w-0 flex-col">
          {accounts.map((account, index) => (
            <div key={account.id}>{renderRow(account, index)}</div>
          ))}
        </div>
      )}
      <Txt as="p" variant="meta" tone="muted">
        When the active account is rate limited, routing switches to the next one in this order. Signing out removes
        only the active account, and removing a key removes only an API key, never a sign-in. The next account in this
        order takes over.
      </Txt>
      {renaming && (
        <RenameAccountDialog
          account={renaming}
          pending={rename.isPending}
          onClose={() => setRenaming(undefined)}
          onSave={label =>
            rename.mutate(
              { accountId: renaming.id, label },
              {
                onSuccess: () => setRenaming(undefined),
                onError: error => toast.error(error.message || 'Failed to rename account'),
              },
            )
          }
        />
      )}
    </div>
  );
}

function AccountRow({
  account,
  manageable,
  disabled,
  dragHandleProps,
  onMoveUp,
  onMoveDown,
  onActivate,
  onRename,
  onRemove,
}: {
  account: PoolAccountSummary;
  manageable: boolean;
  disabled: boolean;
  dragHandleProps: DragHandleProps | null | undefined;
  onMoveUp: (() => void) | undefined;
  onMoveDown: (() => void) | undefined;
  onActivate: () => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  const reorderable = manageable && (onMoveUp !== undefined || onMoveDown !== undefined);
  return (
    <div className="flex min-h-8 items-center gap-2" role="group" aria-label={account.label}>
      {reorderable && dragHandleProps && (
        <span
          {...dragHandleProps}
          aria-label={`Drag ${account.label}`}
          className={disabled ? 'pointer-events-none' : undefined}
        >
          <GripVertical aria-hidden="true" className="text-muted-foreground size-3.5" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Txt as="span" variant="caption" className="truncate">
          {account.label}
        </Txt>
        {account.active && (
          <Badge variant="success" size="xs">
            Active
          </Badge>
        )}
      </span>
      <Txt as="span" variant="meta" tone="muted" className="shrink-0">
        {ACCOUNT_TYPE_LABEL[account.type]}
      </Txt>
      <Txt as="span" variant="meta" tone="muted" className="shrink-0">
        <Status presentation={accountStatus(account)} />
      </Txt>
      {manageable && (
        <>
          {reorderable && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${account.label} up`}
                disabled={disabled || !onMoveUp}
                onClick={onMoveUp}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${account.label} down`}
                disabled={disabled || !onMoveDown}
                onClick={onMoveDown}
              >
                <ArrowDown />
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`${account.label} actions`} disabled={disabled}>
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownMenu.Content align="end">
              {!account.active && <DropdownMenu.Item onClick={onActivate}>Make active</DropdownMenu.Item>}
              <DropdownMenu.Item onClick={onRename}>Rename</DropdownMenu.Item>
              <DropdownMenu.Item onClick={onRemove}>Remove</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

function RenameAccountDialog({
  account,
  pending,
  onClose,
  onSave,
}: {
  account: PoolAccountSummary;
  pending: boolean;
  onClose: () => void;
  onSave: (label: string) => void;
}) {
  const [draft, setDraft] = useState(account.label);
  const label = draft.trim();
  const save = () => {
    if (label && label !== account.label) onSave(label);
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()} pending={pending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename account</DialogTitle>
          <DialogDescription>The name only labels this account in Factory.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input
            autoFocus
            aria-label="Account name"
            value={draft}
            disabled={pending}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') save();
              if (event.key === 'Escape') onClose();
            }}
          />
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!label || label === account.label} onConfirm={save}>
            {pending ? 'Saving…' : 'Save'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
