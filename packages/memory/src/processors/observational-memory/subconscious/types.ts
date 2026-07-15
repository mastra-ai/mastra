import type { Agent, AgentConfig } from '@mastra/core/agent';
import type { KnowledgeScopeLevel } from '@mastra/core/storage';
import type { z } from 'zod';

import type { ExtractorOnExtractedContext } from '../extractor';

export type SubconsciousBuiltInObservationAgent = 'capture' | 'remind';
export type SubconsciousBuiltInReflectionAgent = 'curate' | 'learn';
export type SubconsciousModel = Exclude<AgentConfig['model'], undefined>;

export interface SubconsciousCaptureOutput {
  entities: Array<{
    name: string;
    kind: string;
    scope?: KnowledgeScopeLevel;
    facts: Array<{
      text: string;
      scope?: KnowledgeScopeLevel;
      when?: string;
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

export interface SubconsciousConfig {
  observation?: SubconsciousObservationEntry[];
  reflection?: SubconsciousReflectionEntry[];
  model?: SubconsciousModel;
  defaultScope?: KnowledgeScopeLevel;
  maxScope?: KnowledgeScopeLevel;
  learnedGuidance?: boolean;
  tools?: boolean;
  activity?: false | { recentUpdates?: number };
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
}
