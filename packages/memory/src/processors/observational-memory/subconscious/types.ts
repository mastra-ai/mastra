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
    items: Array<{
      text: string;
      scope?: KnowledgeScopeLevel;
      when?: string;
      /** One short sentence: why the KnowledgeItem is worth keeping (or must stay pinned). Stored as item metadata. */
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
   * Run the curator once this many knowledge updates have accumulated past the
   * curation cursor. Defaults to 20; set `false` to disable the volume trigger.
   */
  curationThreshold?: number | false;
  /**
   * Milliseconds since the last completed curation after which the curator runs
   * even if fewer than `curationThreshold` updates are pending. Defaults to one
   * hour. Set `false` to disable the time trigger — note that elapsed time still
   * bounds retries: after a curation that leaves the cursor where it found it,
   * both triggers wait one hour before trying again.
   */
  curationInterval?: number | false;
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
  curationThreshold: number | false;
  curationIntervalMs: number | false;
}
