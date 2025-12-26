// Main exports
export { Trainer, createTrainer, type TrainerOptions } from './trainer';

// Types
export * from './types';

// Dataset sources
export {
  BaseDatasetSource,
  type DatasetSource,
  TracesSource,
  createTracesSource,
  ArraySource,
  createArraySource,
  FileSource,
  createFileSource,
  createDatasetSource,
} from './dataset';

// Scoring
export {
  computeCompositeScore,
  createCompositeConfig,
  validateScorerCoverage,
  applyGates,
  createGate,
  formatGateResults,
  createScorecard,
} from './scoring';

// Rendering
export {
  toJsonl,
  toJsonlBuffer,
  parseJsonl,
  parseJsonlBuffer,
  streamJsonlLines,
  renderSftJsonl,
  renderSftJsonlWithOptions,
  getSftStats,
  renderDpoJsonl,
  renderSimpleDpoJsonl,
  renderDpoJsonlWithOptions,
  getDpoStats,
  renderTrainingData,
  renderValidationData,
  getTrainingStats,
  type SftRenderOptions,
  type DpoRenderOptions,
} from './rendering';

// Utilities
export { hashInput, hashMessages, applySelection, getSelectionStats } from './utils';

// Providers
export { OpenAIProvider, type OpenAIProviderOptions } from './providers/openai';

// Provider factory
export function createOpenAIProvider(options: { apiKey?: string; baseUrl?: string; organizationId?: string }) {
  const { OpenAIProvider } = require('./providers/openai');
  return new OpenAIProvider({
    apiKey: options.apiKey || process.env.OPENAI_API_KEY || '',
    baseUrl: options.baseUrl,
    organization: options.organizationId,
  });
}

// Provider interface (for implementing custom providers)
export type { TrainerProvider, StartJobArgs } from './types';
