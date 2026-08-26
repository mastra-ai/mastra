import { Input } from '@mastra/playground-ui/components/Input';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useRepositorySettingsQuery, useSaveRepositorySettingsMutation } from '../../../../hooks/useRepositorySettings';
import type { FactoryProject } from '../../workspaces/services/github';
import { SettingsCard } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';

function CommandInput({
  label,
  value,
  placeholder,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string>();
  const current = draft ?? value;

  const commit = () => {
    setDraft(undefined);
    if (current.trim() !== value) onCommit(current.trim());
  };

  return (
    <Input
      size="sm"
      aria-label={label}
      placeholder={placeholder}
      className="font-mono"
      value={current}
      disabled={disabled}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

function RepositoryCommands({ projectRepositoryId, label }: { projectRepositoryId: string; label: string }) {
  const settingsQuery = useRepositorySettingsQuery(projectRepositoryId);
  const saveMutation = useSaveRepositorySettingsMutation();

  const setupCommand = settingsQuery.data?.setupCommand ?? '';
  const teardownCommand = settingsQuery.data?.teardownCommand ?? '';
  const busy = settingsQuery.isPending || saveMutation.isPending;

  const save = (settings: { setupCommand: string; teardownCommand: string }) => {
    saveMutation.mutate(
      {
        projectRepositoryId,
        settings: {
          setupCommand: settings.setupCommand || null,
          teardownCommand: settings.teardownCommand || null,
        },
      },
      {
        onSuccess: () => toast.success('Worktree commands saved'),
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save worktree commands'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Txt as="p" variant="ui-xs" className="text-icon3 font-mono">
        {label}
      </Txt>
      <SettingsCard>
        <SettingsRow variant="factory" label="Setup" description="Runs once the worktree is created, before the agent.">
          <div className="w-full lg:max-w-96">
            <CommandInput
              label={`Setup command for ${label}`}
              value={setupCommand}
              placeholder="e.g. pnpm i && pnpm build"
              disabled={busy}
              onCommit={value => save({ setupCommand: value, teardownCommand })}
            />
          </div>
        </SettingsRow>
        <SettingsRow
          variant="factory"
          label="Teardown"
          description="Runs when the worktree is discarded, and again if setup fails."
        >
          <div className="w-full lg:max-w-96">
            <CommandInput
              label={`Teardown command for ${label}`}
              value={teardownCommand}
              placeholder="e.g. pnpm local worktree teardown"
              disabled={busy}
              onCommit={value => save({ setupCommand, teardownCommand: value })}
            />
          </div>
        </SettingsRow>
      </SettingsCard>
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
    <SettingsSubsection title="Worktree commands" description="Shell commands each session runs in its own worktree.">
      <div className="flex flex-col gap-4">
        {rows.map(row => (
          <RepositoryCommands
            key={row.projectRepositoryId}
            projectRepositoryId={row.projectRepositoryId}
            label={row.label}
          />
        ))}
      </div>
    </SettingsSubsection>
  );
}
