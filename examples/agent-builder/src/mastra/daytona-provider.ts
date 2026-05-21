import type { SandboxProvider } from '@mastra/core/editor';
import { DaytonaSandbox, type DaytonaSandboxOptions } from '@mastra/daytona';

/**
 * Serializable subset of DaytonaSandboxOptions for editor storage.
 */
type DaytonaProviderConfig = Pick<
  DaytonaSandboxOptions,
  | 'id'
  | 'apiKey'
  | 'apiUrl'
  | 'target'
  | 'timeout'
  | 'language'
  | 'resources'
  | 'env'
  | 'labels'
  | 'snapshot'
  | 'image'
  | 'ephemeral'
  | 'autoStopInterval'
  | 'autoArchiveInterval'
  | 'autoDeleteInterval'
  | 'volumes'
  | 'name'
  | 'user'
  | 'public'
  | 'networkBlockAll'
  | 'networkAllowList'
>;

export const daytonaSandboxProvider: SandboxProvider<DaytonaProviderConfig> = {
  id: 'daytona',
  name: 'Daytona Sandbox',
  description: 'Cloud sandbox powered by Daytona',
  createSandbox: config => new DaytonaSandbox(config),
};
