import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import { SEEDED_MODEL_SELECTION_KEY } from './model-selection.js';
import type { ModelSelection } from './model-selection.js';

const SUBAGENT_TYPES = ['explore', 'plan', 'execute'] as const;

export interface ModelSelectionSession {
  model: { switch(modelId: string, options?: { thinkingLevel?: ThinkingLevelSetting }): Promise<unknown> };
  state: { set(updates: { thinkingLevel?: undefined }): Promise<unknown> };
  subagents: { model: { set(args: { modelId: string; agentType: string }): Promise<unknown> } };
  thread: {
    getSetting(args: { key: string }): Promise<unknown>;
    setSetting(args: { key: string; value: unknown }): Promise<unknown>;
  };
}

export async function isSeeded(session: Pick<ModelSelectionSession, 'thread'>): Promise<boolean> {
  return (await session.thread.getSetting({ key: SEEDED_MODEL_SELECTION_KEY })) !== undefined;
}

/**
 * Copy a default pair onto the active thread and mark the thread as seeded.
 * A null thinking level clears the thread override so the Factory fallback applies.
 */
export async function seedModelSelection(session: ModelSelectionSession, selection: ModelSelection): Promise<void> {
  if (selection.thinkingLevel) {
    await session.model.switch(selection.modelId, { thinkingLevel: selection.thinkingLevel });
  } else {
    await session.model.switch(selection.modelId);
    await session.state.set({ thinkingLevel: undefined });
  }
  for (const agentType of SUBAGENT_TYPES) {
    await session.subagents.model.set({ modelId: selection.modelId, agentType });
  }
  await session.thread.setSetting({ key: SEEDED_MODEL_SELECTION_KEY, value: selection });
}
