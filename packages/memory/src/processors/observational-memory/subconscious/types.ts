import type { Agent, AgentConfig } from '@mastra/core/agent';
import type { KnowledgeScopeLevel } from '@mastra/core/storage';
import type { z } from 'zod';

import type { ExtractorOnExtractedContext } from '../extractor';

export type SubconsciousBuiltInObservationAgent = 'capture' | 'remind';
export type SubconsciousBuiltInReflectionAgent = 'curate' | 'learn';
export type SubconsciousModel = Exclude<AgentConfig['model'], undefined>;

export interface SubconsciousCaptureOutput {
  nodes: Array<{
    name: string;
    kind: string;
    scope?: KnowledgeScopeLevel;
    records: Array<{
      text: string;
      scope?: KnowledgeScopeLevel;
      when?: string;
      /** One short sentence: why the KnowledgeRecord is worth keeping (or must stay pinned). Stored as record metadata. */
      reason?: string;
      /** Present only when capture-time pinning is enabled; routes the item to the pin set. */
      pin?: boolean;
    }>;
  }>;
}

export type SubconsciousDefaultCapture = (
  context: ExtractorOnExtractedContext<SubconsciousCaptureOutput>,
) => Promise<void>;

export type SubconsciousCaptureHook = (
  context: ExtractorOnExtractedContext<SubconsciousCaptureOutput> & {
    defaultImplementation: SubconsciousDefaultCapture;
  },
) => Promise<SubconsciousCaptureOutput | void | undefined> | SubconsciousCaptureOutput | void | undefined;

export interface SubconsciousCaptureConfig {
  name: 'capture';
  instructions?: string;
  schema?: z.ZodTypeAny;
  onExtracted?: SubconsciousCaptureHook;
}

export interface SubconsciousRemindConfig {
  name: 'remind';
  instructions?: string;
  model?: SubconsciousModel;
  maxSteps?: number;
}

export type SubconsciousBuiltInObservationConfig = SubconsciousCaptureConfig | SubconsciousRemindConfig;

export interface SubconsciousCustomObservationConfig<T = unknown> {
  name: string;
  instructions?: string;
  schema: z.ZodType<T>;
  onExtracted: (context: ExtractorOnExtractedContext<T>) => Promise<T | void | undefined> | T | void | undefined;
}

export interface SubconsciousBuiltInReflectionConfig {
  name: SubconsciousBuiltInReflectionAgent;
  instructions?: string;
  model?: SubconsciousModel;
  maxSteps?: number;
}

export interface SubconsciousCustomReflectionConfig {
  name: string;
  instructions?: string;
  agent?: Agent;
  model?: SubconsciousModel;
  maxSteps?: number;
}

export type SubconsciousObservationEntry =
  | SubconsciousBuiltInObservationAgent
  | SubconsciousBuiltInObservationConfig
  | SubconsciousCustomObservationConfig;

export type SubconsciousReflectionEntry =
  | SubconsciousBuiltInReflectionAgent
  | SubconsciousBuiltInReflectionConfig
  | SubconsciousCustomReflectionConfig;

/** @experimental This API may change without notice. */
export interface SubconsciousConfig {
  observation?: SubconsciousObservationEntry[];
  reflection?: SubconsciousReflectionEntry[];
  model?: SubconsciousModel;
  defaultScope?: KnowledgeScopeLevel;
  maxScope?: KnowledgeScopeLevel;
  learnedGuidance?: boolean;
  tools?: boolean;
  activity?: false | { recentUpdates?: number };
  /**
   * Opt in to a curator-maintained pinned knowledge page that is delivered on every turn.
   * Off by default: the cost of a pin is per turn and permanent.
   * `capturePinning` (off by default, even with `pins: true`) additionally lets the capture
   * agent pin at observation time; capture-time pins are for durable user preferences and
   * hard constraints only and share the same budget.
   */
  pins?: boolean | { maxPins?: number; maxCharacters?: number; capturePinning?: boolean };
  /**
   * Run the curator after every N committed observation runs (in addition to any
   * caller-driven `Memory.runCuration` triggers). Off by default.
   */
  curationCadence?: number;
  /**
   * Run the curator once this many uncurated knowledge records have accumulated since the
   * last curation cursor. Evaluated lazily, whenever the observational lifecycle already has
   * a reason to look — never on a timer. Off by default.
   */
  curationThreshold?: number | false;
  /**
   * How stale the last curation may get before the next lifecycle evaluation runs the curator.
   *
   * This is an **opportunistic age threshold, not a timer and not a scheduled job**: nothing is
   * ever scheduled, and with no activity on the resource nothing fires. The age condition is only
   * consulted when the lifecycle is already evaluating (an observation, an activation, or the end
   * of a turn), and it additionally requires at least one uncurated record to exist — an idle
   * resource never calls the curator with nothing to curate. Off by default.
   */
  curationMaxAgeMs?: number | false;
  maxSteps?: number;
}

export interface ResolvedSubconsciousAgent {
  name: string;
  instructions?: string;
  model?: SubconsciousModel;
  agent?: Agent;
  maxSteps?: number;
  builtIn: boolean;
}

export interface ResolvedSubconsciousConfig {
  observation: ResolvedSubconsciousAgent[];
  reflection: ResolvedSubconsciousAgent[];
  defaultScope: KnowledgeScopeLevel;
  maxScope?: KnowledgeScopeLevel;
  learnedGuidance: boolean;
  tools: boolean;
  activity: false | { recentUpdates: number };
  pins: false | { maxPins: number; maxCharacters: number; capturePinning: boolean };
  curationCadence?: number;
  curationThreshold: number | false;
  curationMaxAgeMs: number | false;
}
