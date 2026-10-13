import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

/** Where Factory's thinking chain ends when neither the thread nor a default picked a level. */
export const FACTORY_FALLBACK_THINKING_LEVEL: ThinkingLevelSetting = 'off';

/** A model and the thinking level chosen with it. A null level defers to {@link FACTORY_FALLBACK_THINKING_LEVEL}. */
export interface ModelSelection {
  modelId: string;
  thinkingLevel: ThinkingLevelSetting | null;
}

export type ModelSelectionSource = 'personal' | 'factory';

/** Thread metadata key recording the default pair a thread was seeded with, and whose default it was. */
export const SEEDED_MODEL_SELECTION_KEY = 'factorySeededModelSelection';

export interface SeededModelSelection extends ModelSelection {
  source: ModelSelectionSource;
}
