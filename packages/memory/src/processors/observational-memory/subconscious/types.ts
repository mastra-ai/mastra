import type { AgentConfig } from '@mastra/core/agent';
import type { KnowledgeScopeLevel } from '@mastra/core/storage';
import type { z } from 'zod';

import type { ExtractorOnExtractedContext } from '../extractor';

export type SubconsciousBuiltInObservationAgent = 'remind' | 'curate';
export type SubconsciousModel = Exclude<AgentConfig['model'], undefined>;

export interface SubconsciousRemindConfig {
  name: 'remind';
  instructions?: string;
  model?: SubconsciousModel;
  maxSteps?: number;
}

export interface SubconsciousCurateConfig {
  name: 'curate';
  instructions?: string;
  model?: SubconsciousModel;
  maxSteps?: number;
}

export type SubconsciousBuiltInObservationConfig = SubconsciousRemindConfig | SubconsciousCurateConfig;

export interface SubconsciousCustomObservationConfig<T = unknown> {
  name: string;
  instructions?: string;
  schema: z.ZodType<T>;
  onExtracted: (context: ExtractorOnExtractedContext<T>) => Promise<T | void | undefined> | T | void | undefined;
}

export type SubconsciousObservationEntry =
  | SubconsciousBuiltInObservationAgent
  | SubconsciousBuiltInObservationConfig
  | SubconsciousCustomObservationConfig;

/** @experimental This API may change without notice. */
export interface SubconsciousConfig {
  observation?: SubconsciousObservationEntry[];
  model?: SubconsciousModel;
  defaultScope?: KnowledgeScopeLevel;
  maxScope?: KnowledgeScopeLevel;
  tools?: boolean;
  activity?: false | { recentUpdates?: number };
  /**
   * Opt in to a curator-maintained pinned knowledge page that is delivered on every turn.
   * Off by default: the cost of a pin is per turn and permanent.
   */
  pins?: boolean | { maxPins?: number; maxCharacters?: number };
  maxSteps?: number;
}

export interface ResolvedSubconsciousAgent {
  name: string;
  instructions?: string;
  model?: SubconsciousModel;
  maxSteps?: number;
  builtIn: boolean;
}

export interface ResolvedSubconsciousConfig {
  observation: ResolvedSubconsciousAgent[];
  defaultScope: KnowledgeScopeLevel;
  maxScope?: KnowledgeScopeLevel;
  tools: boolean;
  activity: false | { recentUpdates: number };
  pins: false | { maxPins: number; maxCharacters: number };
}
