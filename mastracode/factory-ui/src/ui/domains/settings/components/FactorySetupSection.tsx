import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@mastra/playground-ui/components/InputGroup';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useRepositorySettingsQuery, useSaveRepositorySettingsMutation } from '../../../../hooks/useRepositorySettings';
import type { FactoryProject } from '../../workspaces/services/github';
import { SettingsCard } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';

function RepositorySetupRow({ projectRepositoryId, label }: { projectRepositoryId: string; label: string }) {
  const settingsQuery = useRepositorySettingsQuery(projectRepositoryId);
  const saveMutation = useSaveRepositorySettingsMutation();

  const saved = settingsQuery.data?.setupCommand ?? '';
  const [draft, setDraft] = useState<string>();
  const currentDraft = draft ?? saved;
  const dirty = currentDraft.trim() !== saved;
  const save = () => {
    saveMutation.mutate(
      { projectRepositoryId, settings: { setupCommand: currentDraft.trim() || null } },
      {
        onSuccess: () => {
          setDraft(undefined);
          toast.success('Setup command saved');
        },
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save setup command'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <Txt as="span" variant="ui-md" className="text-icon5">
        {label}
      </Txt>
      <InputGroup size="sm">
        <InputGroupInput
          aria-label={`Setup command for ${label}`}
          placeholder="e.g. pnpm i && pnpm build"
          className="font-mono"
          value={currentDraft}
          disabled={settingsQuery.isPending || saveMutation.isPending}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && dirty) save();
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="sm"
            variant="default"
            disabled={!dirty || settingsQuery.isPending || saveMutation.isPending}
            onClick={save}
          >
            Save
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

export function FactorySetupSection({ factory }: { factory: FactoryProject }) {
  const rows = factory.repositories.map(repository => ({
    projectRepositoryId: repository.projectRepositoryId,
    label: repository.slug,
  }));
  if (rows.length === 0) return null;

  return (
    <SettingsSubsection title="Worktree setup" description="Runs in every new worktree before any agent starts.">
      <SettingsCard>
        {rows.map(row => (
          <RepositorySetupRow
            key={row.projectRepositoryId}
            projectRepositoryId={row.projectRepositoryId}
            label={row.label}
          />
        ))}
      </SettingsCard>
    </SettingsSubsection>
  );
}
