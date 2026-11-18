import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

import { PendingField } from '../../../../ui/PendingField';
import { CommittedInput } from './CommittedInput';
import type { SaveEnvironment } from './CommittedInput';

/**
 * Where the repositories are cloned, the one command that runs there after
 * every repository is set up, then whatever rows the caller adds (the
 * provider's own settings).
 */
export function WorkspaceSetupBlock({
  workdir,
  command,
  pending,
  disabled,
  onSave,
  children,
}: {
  workdir: string | null;
  command: string | null;
  pending: boolean;
  disabled: boolean;
  onSave: SaveEnvironment;
  children?: ReactNode;
}) {
  return (
    <SettingsContainer>
      <SettingsRow label="Working directory" description="Absolute path where repositories are cloned.">
        <PendingField pending={pending} className="w-full">
          <CommittedInput
            label="Working directory"
            placeholder={pending ? undefined : '/workspace'}
            value={workdir ?? ''}
            disabled={disabled}
            onCommit={raw => onSave({ sandboxWorkingDirectory: raw || null })}
          />
        </PendingField>
      </SettingsRow>
      <SettingsRow label="Setup command" description="Runs from the working directory once every repository is cloned.">
        <PendingField pending={pending} className="w-full">
          <CommittedInput
            label="Setup command"
            value={command ?? ''}
            placeholder={pending ? undefined : 'e.g. ./scripts/bootstrap.sh'}
            disabled={disabled}
            onCommit={next => onSave({ workspaceSetupCommand: next || null })}
          />
        </PendingField>
      </SettingsRow>
      {children}
    </SettingsContainer>
  );
}
