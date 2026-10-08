import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { CommittedInput, type SaveEnvironment } from './CommittedInput';

/** One command that runs in the working directory after every repository is cloned and set up. */
export function WorkspaceSetupBlock({
  value,
  disabled,
  onSave,
}: {
  value: string | null;
  disabled: boolean;
  onSave: SaveEnvironment;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Txt as="h3" variant="label">
        Workspace setup
      </Txt>
      <SettingsContainer>
        <SettingsRow
          label="Command"
          description="Runs in the working directory after every repository's setup, while the template builds."
        >
          <div className="w-full lg:max-w-96">
            <CommittedInput
              label="Workspace setup command"
              value={value ?? ''}
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
