import { SandboxSettings } from '@mastra/playground-ui/components/SandboxSettings';

import type { FactoryEnvironmentPayload } from '../../../workspaces/services/environment';
import type { SaveEnvironment } from './CommittedInput';

const PROVIDER_LABELS: Record<string, string> = {
  platform: 'the Mastra platform',
  e2b: 'E2B',
  docker: 'Docker',
  local: 'the local machine',
  custom: 'a custom sandbox',
  none: 'no sandbox',
};

/** "Sandboxes run on E2B" for a known provider id, the raw id otherwise. */
export function providerLine(provider: string): string {
  return `Sandboxes run on ${PROVIDER_LABELS[provider] ?? provider}.`;
}

/** The provider's own sandbox settings, each row committing its own PATCH. */
export function SandboxBlock({
  environment,
  disabled,
  onSave,
}: {
  environment: FactoryEnvironmentPayload;
  disabled: boolean;
  onSave: SaveEnvironment;
}) {
  return (
    <SandboxSettings
      schema={environment.sandbox.settingsSchema}
      values={environment.settings}
      disabled={disabled}
      onCommit={(key, value) => onSave({ settings: { [key]: value } })}
    />
  );
}
