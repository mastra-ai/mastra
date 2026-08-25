import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import {
  useGithubPatStatusQuery,
  useRemoveGithubPatMutation,
  useSaveGithubPatMutation,
} from '../../../../hooks/useGithubPat';
import type { GithubPatKind } from '../../workspaces/services/github';
import { SettingsCard } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';

/**
 * Org-wide GitHub Personal Access Tokens used only for `gh` CLI auth inside
 * Factory sandboxes. GitHub App installation tokens 403 on the endpoints the
 * CLI needs ("Resource not accessible by integration"), so agents need PATs
 * there; git clone/push and API access keep using the app installation.
 *
 * Two tokens: the worker token every sandbox gets, and an optional reviewer
 * token used by review-board sessions so PR reviews come from a different
 * account. Without a reviewer token, review sessions use the worker token.
 */
export function GithubPatBlock() {
  const statusQuery = useGithubPatStatusQuery();

  return (
    <SettingsSubsection
      title="GitHub CLI tokens"
      description="Classic PATs agents use for gh CLI commands in sandboxes. The token's account needs access to the linked repositories."
    >
      <SettingsCard>
        <TokenRow
          kind="default"
          title="Worker token"
          description="Used by every sandbox."
          configured={statusQuery.data?.configured === true}
        />
        <TokenRow
          kind="reviewer"
          title="Reviewer token (optional)"
          description="Used by review sessions so PR reviews come from a different account. Falls back to the worker token."
          configured={statusQuery.data?.reviewerConfigured === true}
        />
      </SettingsCard>
    </SettingsSubsection>
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
  const saveMutation = useSaveGithubPatMutation(kind);
  const removeMutation = useRemoveGithubPatMutation(kind);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const busy = saveMutation.isPending || removeMutation.isPending;
  const mutationError = saveMutation.error ?? removeMutation.error;
  const error = mutationError instanceof Error ? mutationError.message : undefined;

  const save = async () => {
    const token = draft.trim();
    if (!token) return;
    try {
      await saveMutation.mutateAsync(token);
      setEditing(false);
      setDraft('');
    } catch {
      // Mutation error is rendered below.
    }
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <Txt variant="ui-md" className="text-icon5">
              {title}
            </Txt>
            <Badge size="sm" variant={configured ? 'success' : 'default'}>
              {configured ? 'Configured' : 'Not set'}
            </Badge>
          </div>
          <Txt variant="ui-sm" className="text-icon3">
            {description}
          </Txt>
        </div>
        {!editing && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setEditing(true);
                setDraft('');
              }}
            >
              {configured ? 'Update token' : 'Add token'}
            </Button>
            {configured && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => removeMutation.mutate()}>
                {removeMutation.isPending ? 'Removing…' : 'Remove'}
              </Button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            type="password"
            size="sm"
            aria-label={`${title} GitHub Personal Access Token`}
            placeholder="Paste classic Personal Access Token"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') void save();
              if (event.key === 'Escape') {
                setEditing(false);
                setDraft('');
              }
            }}
          />
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setDraft('');
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={busy || !draft.trim()} onClick={() => void save()}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}

      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}
    </div>
  );
}
