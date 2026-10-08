import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { FactoryEnvironmentPayload } from '../../../workspaces/services/environment';
import { CommittedInput, wholeNumber, type SaveEnvironment } from './CommittedInput';

/** The sandbox every session boots: provider, size, idle timeout and working directory. */
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
        <SettingsRow label="Provider" description="Where sandboxes run. Set by the host.">
          <Txt as="span" font="mono" variant="body-sm">
            {environment.sandboxProvider ?? 'not configured'}
          </Txt>
        </SettingsRow>
        <SettingsRow label="CPU" description="Cores reserved for each sandbox (1 to 64).">
          <div className="w-full lg:max-w-32">
            <CommittedInput
              label="CPU cores"
              type="number"
              min={1}
              max={64}
              value={String(environment.sandboxCpuCount)}
              disabled={disabled}
              onCommit={raw => {
                const sandboxCpuCount = wholeNumber(raw, 1, 64);
                return sandboxCpuCount === undefined ? Promise.resolve(false) : onSave({ sandboxCpuCount });
              }}
            />
          </div>
        </SettingsRow>
        <SettingsRow label="Memory" description="Megabytes reserved for each sandbox (512 to 65536).">
          <div className="w-full lg:max-w-32">
            <CommittedInput
              label="Memory in megabytes"
              type="number"
              min={512}
              max={65536}
              value={String(environment.sandboxMemoryMb)}
              disabled={disabled}
              onCommit={raw => {
                const sandboxMemoryMb = wholeNumber(raw, 512, 65536);
                return sandboxMemoryMb === undefined ? Promise.resolve(false) : onSave({ sandboxMemoryMb });
              }}
            />
          </div>
        </SettingsRow>
        <SettingsRow
          label="Idle timeout"
          description="Minutes without activity before a sandbox stops. Empty keeps it running."
        >
          <div className="w-full lg:max-w-32">
            <CommittedInput
              label="Idle timeout in minutes"
              type="number"
              min={1}
              max={1440}
              placeholder="none"
              value={
                environment.sandboxIdleTimeoutMinutes === null ? '' : String(environment.sandboxIdleTimeoutMinutes)
              }
              disabled={disabled}
              onCommit={raw => {
                if (raw === '') return onSave({ sandboxIdleTimeoutMinutes: null });
                const minutes = wholeNumber(raw, 1, 1440);
                return minutes === undefined ? Promise.resolve(false) : onSave({ sandboxIdleTimeoutMinutes: minutes });
              }}
            />
          </div>
        </SettingsRow>
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
