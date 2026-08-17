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

function RepositoryLifecycleRow({ projectRepositoryId, label }: { projectRepositoryId: string; label: string }) {
  const settingsQuery = useRepositorySettingsQuery(projectRepositoryId);
  const saveMutation = useSaveRepositorySettingsMutation();

  const savedSetup = settingsQuery.data?.setupCommand ?? '';
  const savedTeardown = settingsQuery.data?.teardownCommand ?? '';
  const [setupDraft, setSetupDraft] = useState<string>();
  const [teardownDraft, setTeardownDraft] = useState<string>();
  const currentSetup = setupDraft ?? savedSetup;
  const currentTeardown = teardownDraft ?? savedTeardown;
  const dirty = currentSetup.trim() !== savedSetup || currentTeardown.trim() !== savedTeardown;
  const save = () => {
    saveMutation.mutate(
      {
        projectRepositoryId,
        settings: {
          setupCommand: currentSetup.trim() || null,
          teardownCommand: currentTeardown.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setSetupDraft(undefined);
          setTeardownDraft(undefined);
          toast.success('Worktree commands saved');
        },
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save worktree commands'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <Txt as="span" variant="ui-md" className="text-icon5">
        {label}
      </Txt>
      <div className="grid gap-2">
        <InputGroup size="sm">
          <InputGroupAddon align="inline-start">Setup</InputGroupAddon>
          <InputGroupInput
            aria-label={`Setup command for ${label}`}
            placeholder="e.g. pnpm i && pnpm build"
            className="font-mono"
            value={currentSetup}
            disabled={settingsQuery.isPending || saveMutation.isPending}
            onChange={e => setSetupDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && dirty) save();
            }}
          />
        </InputGroup>
        <InputGroup size="sm">
          <InputGroupAddon align="inline-start">Teardown</InputGroupAddon>
          <InputGroupInput
            aria-label={`Teardown command for ${label}`}
            placeholder="e.g. pnpm local worktree teardown"
            className="font-mono"
            value={currentTeardown}
            disabled={settingsQuery.isPending || saveMutation.isPending}
            onChange={e => setTeardownDraft(e.target.value)}
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
    <SettingsSubsection
      title="Worktree lifecycle"
      description="Setup runs before agent work. Teardown may be retried during retirement, so keep it idempotent."
    >
      <SettingsCard>
        {rows.map(row => (
          <RepositoryLifecycleRow
            key={row.projectRepositoryId}
            projectRepositoryId={row.projectRepositoryId}
            label={row.label}
          />
        ))}
      </SettingsCard>
    </SettingsSubsection>
  );
}
