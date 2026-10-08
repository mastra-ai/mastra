import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { FactoryEnvironmentPayload } from '../../../workspaces/services/environment';
import { CommittedInput, type SaveEnvironment } from './CommittedInput';

/** The sandbox every session boots: its working directory. Provider settings render from the schema (segment 4). */
export function ResourcesBlock({
  environment,
  disabled,
  onSave,
}: {
  environment: FactoryEnvironmentPayload;
  disabled: boolean;
  onSave: SaveEnvironment;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Txt as="h3" variant="label">
        Resources
      </Txt>
      <SettingsContainer>
        <SettingsRow label="Working directory" description="Absolute path the repositories are cloned under.">
          <div className="w-full lg:max-w-96">
            <CommittedInput
              label="Working directory"
              placeholder="/workspace"
              value={environment.sandboxWorkdir ?? ''}
              disabled={disabled}
              onCommit={raw => onSave({ sandboxWorkdir: raw || null })}
            />
          </div>
        </SettingsRow>
      </SettingsContainer>
    </div>
  );
}
