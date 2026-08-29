/**
 * E2B Template Utilities
 *
 * Helper functions for creating and managing E2B sandbox templates.
 */
import { createHash } from 'node:crypto';
import { Template } from 'e2b';
import type { TemplateBuilder } from 'e2b';

// =============================================================================
// Template Types
// =============================================================================

/**
 * Template specification for E2B sandbox.
 *
 * Can be:
 * - `string` - Existing template ID (e.g., 'base', 'my-custom-template')
 * - `TemplateBuilder` - A built template object from Template()
 * - `(base: TemplateBuilder) => TemplateBuilder` - Callback to customize the base template
 *
 * @example Using template ID
 * ```typescript
 * new E2BSandbox({ template: 'my-custom-template' })
 * ```
 *
 * @example Using Template builder
 * ```typescript
 * import { Template } from 'e2b';
 *
 * new E2BSandbox({
 *   template: Template()
 *     .fromUbuntuImage('22.04')
 *     .aptInstall(['s3fs', 'curl'])
 *     .setEnvs({ NODE_ENV: 'production' })
 * })
 * ```
 *
 * @example Customizing default mountable template
 * ```typescript
 * new E2BSandbox({
 *   template: base => base
 *     .aptInstall(['nodejs', 'npm'])
 *     .runCmd('npm install -g typescript')
 * })
 * ```
 */
export type TemplateSpec =
  | string
  | TemplateBuilder
  | ((base: TemplateBuilder) => TemplateBuilder)
  | NamedTemplateSpec
  | DeferredNamedTemplateSpec;

/**
 * A template builder paired with a deterministic name (the word E2B's own
 * `Template.build(template, name)` uses: the name IS the identity, and may
 * carry a `:tag` qualifier).
 *
 * Resolution is lazy build-if-missing: the sandbox checks
 * `Template.exists(name)` and reuses the existing build when present, so
 * every sandbox constructed with the same name shares one template. When
 * the name is missing the build runs once; if the build fails the sandbox
 * falls back to `fallbackTemplate` (or the default mountable template) so a
 * broken build degrades to a cold start instead of a wedged session.
 */
export interface NamedTemplateSpec {
  /** Deterministic template ref (`name:tag`, e.g. content-hashed name). */
  ref: string;
  /** Builder used when no template exists under the name yet. */
  template: TemplateBuilder;
  /**
   * Template used when the named build fails. May itself be a named spec,
   * resolved exists-then-build under its own name — one rung only: a named
   * fallback's own `fallbackTemplate` is ignored, and anything failing past
   * it lands on the default mountable template. Defaults to the default
   * mountable template.
   */
  fallbackTemplate?: string | TemplateBuilder | NamedTemplateSpec;
  /**
   * Ref (`name:tag`) of a previous successful build of this template. When
   * `name` does not exist yet but this ref does, the sandbox is created
   * from the stale build immediately and the `name` build is kicked off in
   * the background (non-blocking rebuild-in-place) — only the very first
   * build of a template ever blocks a sandbox start.
   */
  staleRef?: string;
  /**
   * Extra tags assigned alongside the name's tag on every successful build
   * (e.g. a stable `current` pointer that {@link staleRef} targets).
   */
  buildTags?: string[];
  /**
   * Machine resources for builds of this template — sandboxes created from
   * it get exactly these. Applied to the named build and its background
   * rebuilds. For content-hashed specs the same values must participate in
   * the name, or a resize would silently reuse a template built at the
   * old size.
   */
  buildResources?: TemplateResources;
}

/** Machine resources for a template build. */
export interface TemplateResources {
  cpuCount?: number;
  memoryMB?: number;
}

/** Options for the default mountable template. */
export interface MountableTemplateOptions extends TemplateResources {
  /**
   * Exact Node.js version installed over the base image's stale runtime
   * (`MAJOR.MINOR.PATCH`). Part of the template identity, so changing it
   * builds a new template. Defaults to {@link DEFAULT_NODE_VERSION}.
   */
  nodeVersion?: string;
}

/**
 * Resource defaults matching the e2b SDK's own build defaults. Hashed and
 * passed to every build explicitly, so a template's identity and its built
 * artifact can never disagree about machine size — even if the SDK
 * defaults drift.
 */
export const DEFAULT_CPU_COUNT = 2;
export const DEFAULT_MEMORY_MB = 1024;

/**
 * Node.js version installed into the default template — the current LTS at
 * pin time. An exact version rather than an `lts` alias so the template's
 * contents can never drift under a stable identity hash; bump deliberately
 * (each bump builds new templates).
 */
export const DEFAULT_NODE_VERSION = '24.20.0';

const NODE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function isNamedTemplateSpec(spec: TemplateSpec): spec is NamedTemplateSpec {
  return typeof spec === 'object' && spec !== null && 'ref' in spec && 'template' in spec;
}

/**
 * A named spec whose name and build steps are computed at resolution time
 * rather than construction time — e.g. a repo template that pins itself to
 * the repository's current default-branch head, fetched right before the
 * exists-then-build check. `resolveSpec()` runs once per `start()` template
 * resolution; failures inside it must be handled by the implementation
 * (return a degraded spec) — a rejection falls through to the sandbox's
 * default-template fallback.
 */
export interface DeferredNamedTemplateSpec {
  resolveSpec(): Promise<NamedTemplateSpec>;
}

export function isDeferredNamedTemplateSpec(spec: TemplateSpec): spec is DeferredNamedTemplateSpec {
  return (
    typeof spec === 'object' &&
    spec !== null &&
    'resolveSpec' in spec &&
    typeof (spec as DeferredNamedTemplateSpec).resolveSpec === 'function'
  );
}

/**
 * Result from createMountableTemplate containing both the template and its ID.
 */
export interface MountableTemplateResult {
  /** The template builder with mount dependencies */
  template: TemplateBuilder;
  /** Deterministic template ID for caching */
  id: string;
  /** List of apt packages installed in the template */
  aptPackages: string[];
  /**
   * Machine resources baked into the identity, normalized to the defaults.
   * Pass these to the build so the artifact matches the hash.
   */
  resources: Required<TemplateResources>;
}

/**
 * Version of the default mountable template.
 * Increment this when changing the default template dependencies.
 * v2 added machine resources to the identity hash.
 * v3 installed a pinned current Node LTS over the base image's stale
 * runtime and enabled corepack.
 */
export const MOUNTABLE_TEMPLATE_VERSION = 'v3';

/**
 * Create a base template with FUSE mounting dependencies pre-installed.
 *
 * This template includes s3fs and fuse packages required for mounting
 * cloud filesystems (S3, GCS, R2) into the sandbox.
 *
 * The returned `id` is deterministic, allowing E2BSandbox to check if
 * the template already exists before building it.
 *
 * @example Basic usage
 * ```typescript
 * const { template, id } = createMountableTemplate();
 * // First time: builds and caches the template
 * // Subsequent times: reuses existing template
 * const sandbox = new E2BSandbox({ template });
 * ```
 *
 * @example With customization
 * ```typescript
 * const { template } = createMountableTemplate();
 * const customTemplate = template
 *   .aptInstall(['nodejs', 'npm'])
 *   .runCmd('npm install -g typescript');
 *
 * // Note: customized templates get a unique ID, not the cached one
 * const sandbox = new E2BSandbox({ template: customTemplate });
 * ```
 *
 * @returns Object with template builder and deterministic ID
 */
export function createDefaultMountableTemplate(options?: MountableTemplateOptions): MountableTemplateResult {
  const aptPackages = ['s3fs', 'fuse'];
  // Resources are part of the template's identity: each machine size is its
  // own template, so a resize can never silently reuse a build at the old
  // size. Absent and explicitly-default are the same template.
  const cpuCount = options?.cpuCount ?? DEFAULT_CPU_COUNT;
  const memoryMB = options?.memoryMB ?? DEFAULT_MEMORY_MB;
  const nodeVersion = options?.nodeVersion ?? DEFAULT_NODE_VERSION;
  // The version is interpolated into a build shell command below, so it is
  // validated before it can be interpolated into one.
  if (!NODE_VERSION_PATTERN.test(nodeVersion)) {
    throw new Error(`Invalid nodeVersion "${nodeVersion}": expected an exact version like "24.20.0"`);
  }
  const config = { version: MOUNTABLE_TEMPLATE_VERSION, aptPackages, cpuCount, memoryMB, nodeVersion };

  const hash = createHash('sha256')
    .update(JSON.stringify(config, Object.keys(config).sort()))
    .digest('hex')
    .slice(0, 16);

  // Build steps and runtime commands both run as the non-root `user` in its
  // home directory — repo checkouts live there (`$HOME/<repo>`), so no
  // extra writable root needs prepping.
  const template = Template()
    .fromTemplate('base')
    .aptInstall(aptPackages)
    // The base image ships a stale Node under /usr/local (v20.9.0 at last
    // check), old enough that corepack-fetched pnpm/yarn crash on it
    // (ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING). Overwrite it in place with
    // a pinned current release so the fresh binaries win the PATH.
    .runCmd(
      `curl -fsSL https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-linux-x64.tar.gz | sudo tar -xz -C /usr/local --strip-components=1`,
    )
    // Corepack shims make `pnpm`/`yarn` resolve to whatever the repo's
    // `packageManager` field pins. It refuses to download a package manager
    // non-interactively unless the prompt is disabled, so persist that for
    // every session, not just the build shell.
    .runCmd('sudo corepack enable')
    .runCmd(`echo 'COREPACK_ENABLE_DOWNLOAD_PROMPT=0' | sudo tee -a /etc/environment`)
    .setEnvs({ COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' });

  // Note: gcsfuse requires adding Google's apt repo which can be flaky
  // For now, we'll install it at mount time if needed

  return {
    template,
    id: `mastra-${hash}`,
    aptPackages,
    resources: { cpuCount, memoryMB },
  };
}
