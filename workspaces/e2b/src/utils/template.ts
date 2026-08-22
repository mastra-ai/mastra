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
 * A template builder paired with a deterministic alias.
 *
 * Resolution is lazy build-if-missing: the sandbox checks
 * `Template.exists(alias)` and reuses the existing build when present, so
 * every sandbox constructed with the same alias shares one template. When
 * the alias is missing the build runs once; if the build fails the sandbox
 * falls back to `fallbackTemplate` (or the default mountable template) so a
 * broken build degrades to a cold start instead of a wedged session.
 */
export interface NamedTemplateSpec {
  /** Deterministic template alias (e.g. content-hashed). */
  alias: string;
  /** Builder used when no template exists under the alias yet. */
  template: TemplateBuilder;
  /**
   * Template used when the aliased build fails. May itself be a named spec,
   * resolved exists-then-build under its own alias — one rung only: a named
   * fallback's own `fallbackTemplate` is ignored, and anything failing past
   * it lands on the default mountable template. Defaults to the default
   * mountable template.
   */
  fallbackTemplate?: string | TemplateBuilder | NamedTemplateSpec;
  /**
   * Ref (`name:tag`) of a previous successful build of this template. When
   * `alias` does not exist yet but this ref does, the sandbox is created
   * from the stale build immediately and the `alias` build is kicked off in
   * the background (non-blocking rebuild-in-place) — only the very first
   * build of a template ever blocks a sandbox start.
   */
  staleRef?: string;
  /**
   * Extra tags assigned alongside the alias tag on every successful build
   * (e.g. a stable `current` pointer that {@link staleRef} targets).
   */
  buildTags?: string[];
}

export function isNamedTemplateSpec(spec: TemplateSpec): spec is NamedTemplateSpec {
  return typeof spec === 'object' && spec !== null && 'alias' in spec && 'template' in spec;
}

/**
 * A named spec whose alias and build steps are computed at resolution time
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
}

/**
 * Version of the default mountable template.
 * Increment this when changing the default template dependencies.
 */
export const MOUNTABLE_TEMPLATE_VERSION = 'v1';

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
export function createDefaultMountableTemplate(): MountableTemplateResult {
  const aptPackages = ['s3fs', 'fuse'];
  const config = { version: MOUNTABLE_TEMPLATE_VERSION, aptPackages };

  const hash = createHash('sha256')
    .update(JSON.stringify(config, Object.keys(config).sort()))
    .digest('hex')
    .slice(0, 16);

  // Build steps and runtime commands both run as the non-root `user` in its
  // home directory — repo checkouts live there (`$HOME/<repo>`), so no
  // extra writable root needs prepping.
  const template = Template().fromTemplate('base').aptInstall(aptPackages);

  // Note: gcsfuse requires adding Google's apt repo which can be flaky
  // For now, we'll install it at mount time if needed

  return {
    template,
    id: `mastra-${hash}`,
    aptPackages,
  };
}
