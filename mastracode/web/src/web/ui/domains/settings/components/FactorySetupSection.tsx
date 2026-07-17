import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect, useState } from 'react';

import { useToast } from '../../../ui';
import {
  useRepositorySettingsQuery,
  useSaveRepositorySettingsMutation,
} from '../../../../../shared/hooks/useRepositorySettings';
import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';
import type { GithubFactory } from '../../workspaces/services/factories';
import { isGithubFactory } from '../../workspaces/services/factories';

/**
 * One editable setup-command row per GitHub factory. The field is a draft —
 * nothing persists until Save — so typing a long command never spams the
 * server. Saving a blank field clears the command.
 */
function FactorySetupRow({ factory }: { factory: GithubFactory }) {
  const { toast } = useToast();
  const githubProjectId = factory.binding.githubProjectId;
  const settingsQuery = useRepositorySettingsQuery(githubProjectId);
  const saveMutation = useSaveRepositorySettingsMutation();

  const saved = settingsQuery.data?.setupCommand ?? '';
  const [draft, setDraft] = useState(saved);
  // Re-sync the draft when the stored value (re)loads.
  useEffect(() => setDraft(saved), [saved]);

  const dirty = draft.trim() !== saved;
  const save = () => {
    saveMutation.mutate(
      { githubProjectId, settings: { setupCommand: draft.trim() || null } },
      {
        onSuccess: () => toast('Setup command saved', 'success'),
        onError: err => toast(err instanceof Error ? err.message : 'Failed to save setup command', 'error'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Txt as="span" variant="ui-sm" className="text-icon5">
        {factory.name}
      </Txt>
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label={`Setup command for ${factory.name}`}
          placeholder="e.g. pnpm i && pnpm build"
          value={draft}
          disabled={settingsQuery.isPending || saveMutation.isPending}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && dirty) save();
          }}
          className="flex-1 rounded-md border border-border1 bg-transparent px-2.5 py-1.5 text-ui-sm text-icon6 font-mono placeholder:text-icon3 focus:outline-none focus:border-border2 disabled:opacity-50"
        />
        <Button size="xs" disabled={!dirty || settingsQuery.isPending || saveMutation.isPending} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

/**
 * Settings › General › Worktree setup: a per-factory shell command (e.g.
 * `pnpm i && pnpm build`) that runs inside every freshly created worktree
 * before any agent execution, so agents always start from a built tree.
 * Rendered only when at least one GitHub factory exists.
 */
export function FactorySetupSection() {
  const factoriesQuery = useFactoriesQuery();
  const githubFactories = (factoriesQuery.data ?? []).filter(isGithubFactory);
  if (githubFactories.length === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-border1/40 flex flex-col gap-4">
      <div className="flex flex-col">
        <Txt variant="ui-lg" className="text-icon6 font-medium">
          Worktree setup
        </Txt>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          Runs in every new worktree before any agent starts. Leave blank to skip setup.
        </Txt>
      </div>
      {githubFactories.map(factory => (
        <FactorySetupRow key={factory.binding.githubProjectId} factory={factory} />
      ))}
    </div>
  );
}
