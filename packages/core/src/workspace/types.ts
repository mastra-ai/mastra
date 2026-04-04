/**
 * Workspace Types
 *
 * Shared types for the workspace module.
 */

import type { RequestContext } from '../request-context';

export type WorkspaceStatus = 'pending' | 'initializing' | 'ready' | 'paused' | 'error' | 'destroying' | 'destroyed';

/**
 * Instructions configuration for workspace providers.
 *
 * - `string` — Fully replaces the default instructions.
 * - `(opts) => string` — Receives the default instructions and optional
 *   request context, allowing the caller to extend or customise per-request.
 *
 * @example Static override
 * ```typescript
 * new LocalFilesystem({
 *   basePath: './data',
 *   instructions: 'Custom instructions for this filesystem.',
 * });
 * ```
 *
 * @example Function form (extend auto-generated)
 * ```typescript
 * new LocalFilesystem({
 *   basePath: './data',
 *   instructions: ({ defaultInstructions, requestContext }) => {
 *     const locale = requestContext?.get('locale') ?? 'en';
 *     return `${defaultInstructions}\nUser locale: ${locale}`;
 *   },
 * });
 * ```
 */
export type InstructionsOption =
  | string
  | ((opts: { defaultInstructions: string; requestContext?: RequestContext }) => string);
