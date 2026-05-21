import { HarnessLegacy } from '@mastra/core/harness';

/**
 * Compatibility base for MastraCode surfaces that still consume the legacy
 * Harness shape. New runtime behavior should live in the Harness v1 runtime
 * modules; this file is the explicit boundary where legacy inheritance remains.
 */
export abstract class MastraCodeHarnessCompat<
  TState extends Record<string, unknown> = Record<string, unknown>,
> extends HarnessLegacy<TState> {}
