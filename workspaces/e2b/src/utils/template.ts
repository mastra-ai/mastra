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
export type TemplateSpec = string | TemplateBuilder | ((base: TemplateBuilder) => TemplateBuilder);

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

  const template = Template().fromTemplate('base').aptInstall(aptPackages);

  // Note: gcsfuse requires adding Google's apt repo which can be flaky
  // For now, we'll install it at mount time if needed

  return {
    template,
    id: `mastra-${hash}`,
    aptPackages,
  };
}
