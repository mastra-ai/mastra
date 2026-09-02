export { E2BSandbox, type E2BSandboxOptions } from './sandbox';
export { E2BProcessManager } from './sandbox/process-manager';
export {
  createDefaultMountableTemplate,
  isNamedTemplateSpec,
  isDeferredNamedTemplateSpec,
  DEFAULT_NODE_VERSION,
  type TemplateSpec,
  type NamedTemplateSpec,
  type DeferredNamedTemplateSpec,
  type MountableTemplateResult,
  type MountableTemplateOptions,
} from './utils/template';
export {
  createRepoTemplate,
  refreshRepoTemplate,
  repoTemplateRef,
  type RepoTemplateOptions,
  type RepoTemplateIdentity,
  type RepositoryAccess,
  type RefreshRepoTemplateResult,
} from './utils/repo-template';
export {
  type E2BS3MountConfig,
  type E2BGCSMountConfig,
  type E2BAzureBlobMountConfig,
  type E2BMountConfig,
} from './sandbox/mounts';
export { e2bSandboxProvider } from './provider';
export { E2BCodeModeTransport } from './code-mode/transport';
