import { z } from 'zod/v4';

import { BatchPartsProcessor } from '../../processors/processors/batch-parts';
import { LanguageDetector } from '../../processors/processors/language-detector';
import type { LanguageDetectorOptions } from '../../processors/processors/language-detector';
import { ModerationProcessor } from '../../processors/processors/moderation';
import type { ModerationOptions } from '../../processors/processors/moderation';
import type { PIIDetectorOptions } from '../../processors/processors/pii-detector';
import { PIIDetector } from '../../processors/processors/pii-detector';
import { PromptInjectionDetector } from '../../processors/processors/prompt-injection-detector';
import type { PromptInjectionOptions } from '../../processors/processors/prompt-injection-detector';
import { SystemPromptScrubber } from '../../processors/processors/system-prompt-scrubber';
import type { SystemPromptScrubberOptions } from '../../processors/processors/system-prompt-scrubber';
import { TokenLimiterProcessor } from '../../processors/processors/token-limiter';
import { ToolCallFilter } from '../../processors/processors/tool-call-filter';
import { UnicodeNormalizer } from '../../processors/processors/unicode-normalizer';
import type { ProcessorProvider, ProcessorPhase } from '../types';

// Reusable schema fragments
const structuredOutputOptionsSchema = z.object({ jsonPromptInjection: z.boolean().optional() }).optional();
const providerOptionsSchema = z.record(z.string(), z.any()).optional();

// ---------------------------------------------------------------------------
// 1. unicode-normalizer
// ---------------------------------------------------------------------------
export const unicodeNormalizerProvider: ProcessorProvider = {
  info: {
    id: 'unicode-normalizer',
    name: 'Unicode Normalizer',
    description: 'Normalizes Unicode text by stripping control characters, collapsing whitespace, and trimming.',
  },
  configSchema: z.object({
    stripControlChars: z.boolean().optional(),
    preserveEmojis: z.boolean().optional(),
    collapseWhitespace: z.boolean().optional(),
    trim: z.boolean().optional(),
  }),
  availablePhases: ['processInput'] as ProcessorPhase[],
  createProcessor(config) {
    return new UnicodeNormalizer(config);
  },
};

// ---------------------------------------------------------------------------
// 2. token-limiter
// ---------------------------------------------------------------------------
export const tokenLimiterProvider: ProcessorProvider = {
  info: {
    id: 'token-limiter',
    name: 'Token Limiter',
    description: 'Limits the number of tokens in messages, supporting both input filtering and output truncation.',
  },
  configSchema: z.object({
    limit: z.number(),
    strategy: z.enum(['truncate', 'abort']).optional(),
    countMode: z.enum(['cumulative', 'part']).optional(),
  }),
  availablePhases: ['processInput', 'processOutputStream', 'processOutputResult'] as ProcessorPhase[],
  createProcessor(config) {
    return new TokenLimiterProcessor(
      config as { limit: number; strategy?: 'truncate' | 'abort'; countMode?: 'cumulative' | 'part' },
    );
  },
};

// ---------------------------------------------------------------------------
// 3. tool-call-filter
// ---------------------------------------------------------------------------
export const toolCallFilterProvider: ProcessorProvider = {
  info: {
    id: 'tool-call-filter',
    name: 'Tool Call Filter',
    description: 'Filters out tool calls and results from messages, optionally targeting specific tools.',
  },
  configSchema: z.object({
    exclude: z.array(z.string()).optional(),
  }),
  availablePhases: ['processInput'] as ProcessorPhase[],
  createProcessor(config) {
    return new ToolCallFilter(config as { exclude?: string[] });
  },
};

// ---------------------------------------------------------------------------
// 4. batch-parts
// ---------------------------------------------------------------------------
export const batchPartsProvider: ProcessorProvider = {
  info: {
    id: 'batch-parts',
    name: 'Batch Parts',
    description: 'Batches multiple stream parts together to reduce stream overhead.',
  },
  configSchema: z.object({
    batchSize: z.number().optional(),
    maxWaitTime: z.number().optional(),
    emitOnNonText: z.boolean().optional(),
  }),
  availablePhases: ['processOutputStream'] as ProcessorPhase[],
  createProcessor(config) {
    return new BatchPartsProcessor(config as { batchSize?: number; maxWaitTime?: number; emitOnNonText?: boolean });
  },
};

// ---------------------------------------------------------------------------
// 5. moderation
// ---------------------------------------------------------------------------
export const moderationProvider: ProcessorProvider = {
  info: {
    id: 'moderation',
    name: 'Moderation',
    description: 'Evaluates content against configurable moderation categories for content safety.',
  },
  configSchema: z.object({
    model: z.string(),
    categories: z.array(z.string()).optional(),
    threshold: z.number().optional(),
    strategy: z.enum(['block', 'warn', 'filter']).optional(),
    instructions: z.string().optional(),
    includeScores: z.boolean().optional(),
    chunkWindow: z.number().optional(),
    structuredOutputOptions: structuredOutputOptionsSchema,
    providerOptions: providerOptionsSchema,
  }),
  availablePhases: ['processInput', 'processOutputResult', 'processOutputStream'] as ProcessorPhase[],
  createProcessor(config) {
    return new ModerationProcessor(config as unknown as ModerationOptions);
  },
};

// ---------------------------------------------------------------------------
// 6. prompt-injection-detector
// ---------------------------------------------------------------------------
export const promptInjectionDetectorProvider: ProcessorProvider = {
  info: {
    id: 'prompt-injection-detector',
    name: 'Prompt Injection Detector',
    description: 'Identifies and handles prompt injection attacks, jailbreaks, and data exfiltration attempts.',
  },
  configSchema: z.object({
    model: z.string(),
    detectionTypes: z.array(z.string()).optional(),
    threshold: z.number().optional(),
    strategy: z.enum(['block', 'warn', 'filter', 'rewrite']).optional(),
    instructions: z.string().optional(),
    includeScores: z.boolean().optional(),
    structuredOutputOptions: structuredOutputOptionsSchema,
    providerOptions: providerOptionsSchema,
  }),
  availablePhases: ['processInput'] as ProcessorPhase[],
  createProcessor(config) {
    return new PromptInjectionDetector(config as unknown as PromptInjectionOptions);
  },
};

// ---------------------------------------------------------------------------
// 7. pii-detector
// ---------------------------------------------------------------------------
export const piiDetectorProvider: ProcessorProvider = {
  info: {
    id: 'pii-detector',
    name: 'PII Detector',
    description: 'Identifies and redacts personally identifiable information for privacy compliance.',
  },
  configSchema: z.object({
    model: z.string(),
    detectionTypes: z.array(z.string()).optional(),
    threshold: z.number().optional(),
    strategy: z.enum(['block', 'warn', 'filter', 'redact']).optional(),
    redactionMethod: z.enum(['mask', 'hash', 'remove', 'placeholder']).optional(),
    instructions: z.string().optional(),
    includeDetections: z.boolean().optional(),
    preserveFormat: z.boolean().optional(),
    structuredOutputOptions: structuredOutputOptionsSchema,
    providerOptions: providerOptionsSchema,
  }),
  availablePhases: ['processInput'] as ProcessorPhase[],
  createProcessor(config) {
    return new PIIDetector(config as unknown as PIIDetectorOptions);
  },
};

// ---------------------------------------------------------------------------
// 8. language-detector
// ---------------------------------------------------------------------------
export const languageDetectorProvider: ProcessorProvider = {
  info: {
    id: 'language-detector',
    name: 'Language Detector',
    description: 'Detects the language of input text and optionally translates it to a target language.',
  },
  configSchema: z.object({
    model: z.string(),
    targetLanguages: z.array(z.string()),
    threshold: z.number().optional(),
    strategy: z.enum(['detect', 'translate', 'block', 'warn']).optional(),
    preserveOriginal: z.boolean().optional(),
    instructions: z.string().optional(),
    minTextLength: z.number().optional(),
    includeDetectionDetails: z.boolean().optional(),
    translationQuality: z.enum(['speed', 'quality', 'balanced']).optional(),
    providerOptions: providerOptionsSchema,
  }),
  availablePhases: ['processInput'] as ProcessorPhase[],
  createProcessor(config) {
    return new LanguageDetector(config as unknown as LanguageDetectorOptions);
  },
};

// ---------------------------------------------------------------------------
// 9. system-prompt-scrubber
// ---------------------------------------------------------------------------
export const systemPromptScrubberProvider: ProcessorProvider = {
  info: {
    id: 'system-prompt-scrubber',
    name: 'System Prompt Scrubber',
    description: 'Detects and removes system prompt leakage from model outputs.',
  },
  configSchema: z.object({
    model: z.string(),
    strategy: z.enum(['block', 'warn', 'filter', 'redact']).optional(),
    customPatterns: z.array(z.string()).optional(),
    includeDetections: z.boolean().optional(),
    instructions: z.string().optional(),
    redactionMethod: z.enum(['mask', 'placeholder', 'remove']).optional(),
    placeholderText: z.string().optional(),
    structuredOutputOptions: structuredOutputOptionsSchema,
  }),
  availablePhases: ['processOutputStream', 'processOutputResult'] as ProcessorPhase[],
  createProcessor(config) {
    return new SystemPromptScrubber(config as unknown as SystemPromptScrubberOptions);
  },
};

// ---------------------------------------------------------------------------
// Aggregated record of all built-in providers
// ---------------------------------------------------------------------------
export const BUILT_IN_PROCESSOR_PROVIDERS: Record<string, ProcessorProvider> = {
  'unicode-normalizer': unicodeNormalizerProvider,
  'token-limiter': tokenLimiterProvider,
  'tool-call-filter': toolCallFilterProvider,
  'batch-parts': batchPartsProvider,
  moderation: moderationProvider,
  'prompt-injection-detector': promptInjectionDetectorProvider,
  'pii-detector': piiDetectorProvider,
  'language-detector': languageDetectorProvider,
  'system-prompt-scrubber': systemPromptScrubberProvider,
};
