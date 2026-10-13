import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

/** Where Factory's thinking chain ends when neither the thread nor a default picked a level. */
export const FACTORY_FALLBACK_THINKING_LEVEL: ThinkingLevelSetting = 'off';

/** A model and the thinking level chosen with it. A null level defers to {@link FACTORY_FALLBACK_THINKING_LEVEL}. */
export interface ModelSelection {
  modelId: string;
  thinkingLevel: ThinkingLevelSetting | null;
}

/** Thread metadata key marking a thread as seeded with a default pair, so it is seeded once. */
export const SEEDED_MODEL_SELECTION_KEY = 'factorySeededModelSelection';
