import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { CommittedInput, type SaveEnvironment } from './CommittedInput';

/**
 * Where the repositories are cloned and the one command that runs there after
 * every repository is cloned and set up.
 */
export function WorkspaceSetupBlock({
  workdir,
  command,
  disabled,
  onSave,
}: {
  workdir: string | null;
  command: string | null;
  disabled: boolean;
  onSave: SaveEnvironment;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Txt as="h3" variant="label">
        Workspace setup
      </Txt>
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
          label="Command"
          description="Runs in the working directory after every repository's setup, while the template builds."
        >
          <div className="w-full lg:max-w-96">
            <CommittedInput
              label="Workspace setup command"
              value={command ?? ''}
              placeholder="e.g. pnpm install"
              disabled={disabled}
              onCommit={next => onSave({ workspaceSetupCommand: next || null })}
            />
          </div>
        </SettingsRow>
      </SettingsContainer>
    </div>
  );
}
