export { E2BSandbox, type E2BSandboxOptions } from './sandbox';
export { E2BProcessManager } from './sandbox/process-manager';
export {
  createDefaultMountableTemplate,
  isNamedTemplateSpec,
  isDeferredNamedTemplateSpec,
  type TemplateSpec,
  type NamedTemplateSpec,
  type DeferredNamedTemplateSpec,
  type MountableTemplateResult,
} from './utils/template';
export { createRepoTemplate, repoTemplateAlias, type RepoTemplateOptions } from './utils/repo-template';
export {
  type E2BS3MountConfig,
  type E2BGCSMountConfig,
  type E2BAzureBlobMountConfig,
  type E2BMountConfig,
} from './sandbox/mounts';
export { e2bSandboxProvider } from './provider';
export { E2BCodeModeTransport } from './code-mode/transport';
