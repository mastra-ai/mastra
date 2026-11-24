import { WorkspaceSetupSettings } from '@mastra/playground-ui/components/SandboxSettings';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

import type { SaveEnvironment } from './CommittedInput';

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
      <WorkspaceSetupSettings
        workingDirectory={workdir}
        setupCommand={command}
        disabled={disabled}
        onWorkingDirectoryCommit={value => onSave({ sandboxWorkingDirectory: value })}
        onSetupCommandCommit={value => onSave({ workspaceSetupCommand: value })}
      />
      {children}
    </SettingsContainer>
  );
}
