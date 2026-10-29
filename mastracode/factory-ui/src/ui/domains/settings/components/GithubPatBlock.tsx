import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  useGithubPatStatusQuery,
  useRemoveGithubPatMutation,
  useSaveGithubPatMutation,
} from '../../../../hooks/useGithubPat';
import { SettingsRowsSkeleton } from '../../../ui/SettingsRowsSkeleton';
import type { GithubPatKind } from '../../workspaces/services/github';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { SettingsSubsection } from './SettingsSubsection';

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

  if (statusQuery.isPending) {
    return <SettingsRowsSkeleton label="Loading GitHub CLI tokens" rows={2} />;
  }
  if (statusQuery.error) {
    return (
      <SettingsRow label="GitHub CLI tokens" errorMsg={statusQuery.error.message}>
        <Button size="sm" icon={<RotateCcw />} onClick={() => void statusQuery.refetch()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }

  return (
    <>
      <TokenRow
        kind="default"
        title="Worker token"
        description="Used by every sandbox."
        configured={statusQuery.data.configured === true}
      />
      <TokenRow
        kind="reviewer"
        title="Reviewer token (optional)"
        description="Used by review sessions so PR reviews come from a different account. Falls back to the worker token."
        configured={statusQuery.data.reviewerConfigured === true}
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
  configured: boolean;
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
      <Badge size="sm" variant={configured ? 'success' : 'neutral'}>
        {configured ? 'Configured' : 'Not set'}
      </Badge>
    </span>
  );

  if (editing) {
    return <TokenEditor kind={kind} title={title} label={label} description={description} onClose={closeEditor} />;
  }

  return (
    <SettingsRow label={label} description={description} errorMsg={removeMutation.error?.message}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          ref={editButton}
          size="sm"
          icon={configured ? <Pencil /> : <Plus />}
          disabled={removeMutation.isPending}
          onClick={() => setEditing(true)}
        >
          {configured ? 'Update token' : 'Add token'}
        </Button>
        {configured && (
          <Button
            size="sm"
            icon={<Trash2 />}
            disabled={removeMutation.isPending}
            onClick={() => removeMutation.mutate()}
          >
            {removeMutation.isPending ? 'Removing…' : 'Remove'}
          </Button>
        )}
      </div>
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
          placeholder="Paste classic Personal Access Token"
          value={draft}
          disabled={saveMutation.isPending}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') save();
            if (event.key === 'Escape' && !saveMutation.isPending) onClose();
          }}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" icon={<X />} disabled={saveMutation.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Check />}
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
