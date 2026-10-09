import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

import { CommittedInput, type SaveEnvironment } from './CommittedInput';

/**
 * Where the repositories are cloned, the one command that runs there after
 * every repository is set up, then whatever rows the caller adds (the
 * provider's own settings).
 */
export function WorkspaceSetupBlock({
  workdir,
  command,
  disabled,
  onSave,
  children,
}: {
  workdir: string | null;
  command: string | null;
  disabled: boolean;
  onSave: SaveEnvironment;
  children?: ReactNode;
}) {
  return (
    <SettingsContainer>
      <SettingsRow label="Working directory" description="Absolute path the repositories are cloned under.">
        <div className="w-full lg:max-w-96">
          <CommittedInput
            label="Working directory"
            placeholder="/workspace"
            value={workdir ?? ''}
            disabled={disabled}
            onCommit={raw => onSave({ sandboxWorkdir: raw || null })}
          />
        </div>
      </SettingsRow>
      <SettingsRow
        label="Setup command"
        description="Runs in the working directory once every repository is cloned and its own setup command has finished, while the template builds."
      >
        <div className="w-full lg:max-w-96">
          <CommittedInput
            label="Setup command"
            value={command ?? ''}
            placeholder="e.g. ./scripts/bootstrap.sh"
            disabled={disabled}
            onCommit={next => onSave({ workspaceSetupCommand: next || null })}
          />
        </div>
      </SettingsRow>
      {children}
    </SettingsContainer>
  );
}
