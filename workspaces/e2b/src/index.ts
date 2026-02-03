/**
 * @mastra/e2b - E2B Sandbox and Filesystem Providers
 *
 * Provides E2B cloud sandbox integration for Mastra workspaces.
 */

export {
  E2BSandbox,
  type E2BSandboxOptions,
  type E2BS3MountConfig,
  type E2BGCSMountConfig,
  type E2BMountConfig,
  type SandboxRuntime,
  type MountHookContext,
  type MountHook,
} from './e2b-sandbox';

export {
  createDefaultMountableTemplate as createMountableTemplate,
  DEFAULT_MOUNTABLE_TEMPLATE_ID,
  type TemplateSpec,
  type MountableTemplateResult,
} from './utils/template';

// export { E2BFilesystem, type E2BFilesystemOptions } from './e2b-filesystem';

// Re-export core mount types for convenience
export type { S3MountConfig, GCSMountConfig, R2MountConfig, MountResult } from '@mastra/core/workspace';
