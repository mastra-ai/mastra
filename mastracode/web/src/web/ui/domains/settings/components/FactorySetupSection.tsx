import { Button } from '@mastra/playground-ui/components/Button';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect, useState } from 'react';

import {
  useRepositorySettingsQuery,
  useSaveRepositorySettingsMutation,
} from '../../../../../shared/hooks/useRepositorySettings';
import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';
import { isServerFactory } from '../../workspaces/services/factories';

/**
 * One editable setup-command row per linked repository. The field is a draft —
 * nothing persists until Save — so typing a long command never spams the
 * server. Saving a blank field clears the command.
 */
function RepositorySetupRow({ projectRepositoryId, label }: { projectRepositoryId: string; label: string }) {
  const settingsQuery = useRepositorySettingsQuery(projectRepositoryId);
  const saveMutation = useSaveRepositorySettingsMutation();

  const saved = settingsQuery.data?.setupCommand ?? '';
  const [draft, setDraft] = useState(saved);
  // Re-sync the draft when the stored value (re)loads.
  useEffect(() => setDraft(saved), [saved]);

  const dirty = draft.trim() !== saved;
  const save = () => {
    saveMutation.mutate(
      { projectRepositoryId, settings: { setupCommand: draft.trim() || null } },
      {
        onSuccess: () => toast.success('Setup command saved'),
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save setup command'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Txt as="span" variant="ui-sm" className="text-icon5">
        {label}
      </Txt>
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label={`Setup command for ${label}`}
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
 * Settings › General › Worktree setup: a per-repository shell command (e.g.
 * `pnpm i && pnpm build`) that runs inside every freshly created worktree
 * before any agent execution, so agents always start from a built tree.
 * Rendered only when at least one linked repository exists.
 */
export function FactorySetupSection() {
  const factoriesQuery = useFactoriesQuery();
  const rows = (factoriesQuery.data ?? []).filter(isServerFactory).flatMap(factory =>
    factory.binding.repositories.map(repository => ({
      projectRepositoryId: repository.projectRepositoryId,
      label: factory.name === repository.slug ? repository.slug : `${factory.name} · ${repository.slug}`,
    })),
  );
  if (rows.length === 0) return null;

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
      {rows.map(row => (
        <RepositorySetupRow
          key={row.projectRepositoryId}
          projectRepositoryId={row.projectRepositoryId}
          label={row.label}
        />
      ))}
    </div>
  );
}
