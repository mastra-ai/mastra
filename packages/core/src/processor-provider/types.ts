import type { ZodSchema } from 'zod';
import type { Processor } from '../processors';

/**
 * The five processor phases corresponding to the five optional methods on Processor.
 */
export type ProcessorPhase =
  | 'processInput'
  | 'processInputStep'
  | 'processOutputStream'
  | 'processOutputResult'
  | 'processOutputStep';

/**
 * All processor phases.
 */
export const ALL_PROCESSOR_PHASES: ProcessorPhase[] = [
  'processInput',
  'processInputStep',
  'processOutputStream',
  'processOutputResult',
  'processOutputStep',
];

/**
 * Metadata about a processor provider.
 */
export interface ProcessorProviderInfo {
  /** Unique identifier for this provider (e.g., 'moderation', 'token-limiter') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description of the provider */
  description?: string;
}

/**
 * Info about a processor available from a provider (used for UI listing).
 */
export interface ProcessorProviderProcessorInfo {
  /** Unique slug for this processor within the provider */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Description of what this processor does */
  description?: string;
  /** Which phases this processor supports */
  availablePhases: ProcessorPhase[];
}

/**
 * Interface for processor providers that supply configurable processors to agents.
 *
 * Processor providers serve two purposes:
 * 1. **Discovery** — UI uses `info`, `configSchema`, `availablePhases` to render configuration forms
 * 2. **Runtime** — Agent hydration uses `createProcessor()` to instantiate processors from stored config
 */
export interface ProcessorProvider {
  /** Provider metadata */
  readonly info: ProcessorProviderInfo;

  /**
   * Zod schema describing the configuration this provider accepts.
   * Used by the UI to render a configuration form.
   * The validated config object is passed to `createProcessor()`.
   */
  readonly configSchema: ZodSchema;

  /**
   * Which processor phases this provider's processors support.
   * Used by the UI to show which phases can be enabled.
   */
  readonly availablePhases: ProcessorPhase[];

  /**
   * Create a processor instance from the given configuration.
   * Called during agent hydration to resolve stored processor configs into live instances.
   *
   * @param config - Configuration object matching `configSchema`
   * @returns A Processor instance
   */
  createProcessor(config: Record<string, unknown>): Processor;
}
