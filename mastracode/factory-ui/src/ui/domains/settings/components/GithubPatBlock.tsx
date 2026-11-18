import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  useGithubPatStatusQuery,
  useRemoveGithubPatMutation,
  useSaveGithubPatMutation,
} from '../../../../hooks/useGithubPat';
import type { GithubPatKind } from '../../workspaces/services/github';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { SettingsSubsection } from './SettingsSubsection';
import { IconArrowRotateCounterClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateCounterClockwise';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

// GitHub App tokens cannot authorize the gh CLI endpoints; sandboxes use PATs.
export function GithubPatBlock() {
  return (
    <SettingsSubsection
      scope="org"
      title="GitHub CLI tokens"
      description="Classic PATs agents use for gh CLI commands in sandboxes. The token's account needs access to the linked repositories."
    >
      <SettingsContainer>
        <TokenRows />
      </SettingsContainer>
    </SettingsSubsection>
  );
}

function TokenRows() {
  const statusQuery = useGithubPatStatusQuery();

  if (statusQuery.error) {
    return (
      <SettingsRow label="GitHub CLI tokens" errorMsg={statusQuery.error.message}>
        <Button size="sm" icon={<IconArrowRotateCounterClockwise />} onClick={() => void statusQuery.refetch()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }

  const status = statusQuery.data;
  return (
    <>
      <TokenRow
        kind="default"
        title="Worker token"
        description="Used by every sandbox."
        configured={status && status.configured === true}
      />
      <TokenRow
        kind="reviewer"
        title="Reviewer token (optional)"
        description="Used by review sessions so PR reviews come from a different account. Falls back to the worker token."
        configured={status && status.reviewerConfigured === true}
      />
    </>
  );
}

function TokenRow({
  kind,
  title,
  description,
  configured,
}: {
  kind: GithubPatKind;
  title: string;
  description: string;
  configured: boolean | undefined;
}) {
  const removeMutation = useRemoveGithubPatMutation(kind);
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const closeEditor = () => {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  };
  const label = (
    <span className="flex items-center gap-2">
      {title}
      {configured === undefined ? (
        <Skeleton aria-hidden className="h-5 w-16 rounded-full motion-reduce:before:animate-none" />
      ) : (
        <Badge size="sm" variant={configured ? 'success' : 'neutral'}>
          {configured ? 'Configured' : 'Not set'}
        </Badge>
      )}
    </span>
  );

  if (editing) {
    return <TokenEditor kind={kind} title={title} label={label} description={description} onClose={closeEditor} />;
  }

  return (
    <SettingsRow label={label} description={description} errorMsg={removeMutation.error?.message}>
      {configured === undefined ? (
        <span role="status" aria-label={`Loading ${title}`}>
          <Skeleton aria-hidden className="h-control-sm w-28 rounded-full motion-reduce:before:animate-none" />
        </span>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            ref={editButton}
            size="sm"
            icon={configured ? <IconPencil /> : <IconPlusMedium />}
            disabled={removeMutation.isPending}
            onClick={() => setEditing(true)}
          >
            {configured ? 'Update token' : 'Add token'}
          </Button>
          {configured && (
            <Button
              size="sm"
              icon={<TrashIcon />}
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              {removeMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          )}
        </div>
      )}
    </SettingsRow>
  );
}

function TokenEditor({
  kind,
  title,
  label,
  description,
  onClose,
}: {
  kind: GithubPatKind;
  title: string;
  label: ReactNode;
  description: string;
  onClose: () => void;
}) {
  const saveMutation = useSaveGithubPatMutation(kind);
  const [draft, setDraft] = useState('');

  const save = () => {
    const token = draft.trim();
    if (!token || saveMutation.isPending) return;
    saveMutation.mutate(token, { onSuccess: onClose });
  };

  return (
    <SettingsRow label={label} description={description} errorMsg={saveMutation.error?.message}>
      <div className="flex min-w-0 flex-col gap-2">
        <Input
          autoFocus
          type="password"
          size="sm"
          aria-label={`${title} GitHub Personal Access Token`}
          placeholder="Paste a classic personal access token"
          value={draft}
          disabled={saveMutation.isPending}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') save();
            if (event.key === 'Escape' && !saveMutation.isPending) onClose();
          }}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" icon={<IconCrossMedium />} disabled={saveMutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<IconCheckmark2Medium />}
            disabled={saveMutation.isPending || !draft.trim()}
            onClick={save}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </SettingsRow>
  );
}
