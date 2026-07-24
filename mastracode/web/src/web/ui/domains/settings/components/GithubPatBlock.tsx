import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import {
  useGithubPatStatusQuery,
  useRemoveGithubPatMutation,
  useSaveGithubPatMutation,
} from '../../../../../shared/hooks/useGithubPat';
import type { GithubPatKind } from '../../workspaces/services/github';

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
    <div className="border-border1 flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-col">
        <Txt variant="ui-md" className="font-medium">
          GitHub CLI tokens
        </Txt>
        <Txt variant="ui-xs">
          Personal Access Tokens agents use for `gh` CLI commands in sandboxes. Tokens must be classic PATs, and the
          token&apos;s account must have access to the linked repositories. Git and API access keep using the GitHub App
          connection.
        </Txt>
      </div>

      <TokenRow
        kind="default"
        title="Worker token"
        description="Used by every sandbox for gh CLI commands (issues, PRs, comments)."
        configured={statusQuery.data?.configured === true}
      />
      <TokenRow
        kind="reviewer"
        title="Reviewer token (optional)"
        description="Used by review-board sessions so PR reviews come from a different account. Falls back to the worker token when not set."
        configured={statusQuery.data?.reviewerConfigured === true}
      />
    </div>
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <Txt variant="ui-sm" className="font-medium">
              {title}
            </Txt>
            <Badge size="sm" variant={configured ? 'success' : 'default'}>
              {configured ? 'Configured' : 'Not set'}
            </Badge>
          </div>
          <Txt variant="ui-xs">{description}</Txt>
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
