// Main processor export
export { ObservationalMemory } from './processor';

// Type exports
export type {
  ObservationalMemoryConfig,
  ObservationalMemoryRecord,
  ObservationalMemoryStorage,
  ObserverConfig,
  ReflectorConfig,
  AgentConfig,
  ThresholdRange,
  ConversationExchange,
} from './types';

export {
  DEFAULT_HISTORY_THRESHOLD,
  DEFAULT_OBSERVATION_THRESHOLD,
  CHARS_PER_TOKEN,
} from './types';

// Observer agent exports (for customization)
export {
  OBSERVER_INSTRUCTIONS,
  createObserverAgent,
  getObserverModelSettings,
  getObserverProviderOptions,
  buildObserverUserPrompt,
  DEFAULT_OBSERVER_MODEL,
  DEFAULT_OBSERVER_MODEL_SETTINGS,
  DEFAULT_OBSERVER_PROVIDER_OPTIONS,
} from './observer-agent';

// Reflector agent exports (for customization)
export {
  REFLECTOR_INSTRUCTIONS,
  createReflectorAgent,
  getReflectorModelSettings,
  getReflectorProviderOptions,
  buildReflectorUserPrompt,
  DEFAULT_REFLECTOR_MODEL,
  DEFAULT_REFLECTOR_MODEL_SETTINGS,
  DEFAULT_REFLECTOR_PROVIDER_OPTIONS,
} from './reflector-agent';

// Utility exports
export {
  estimateTokenCount,
  compressObservationTokens,
  cleanMessagesForEncoding,
  encodeMessagesForPrompt,
  getMessageTextContent,
} from './utils';
