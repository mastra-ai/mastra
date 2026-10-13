import { isThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { z } from 'zod';

import { SEEDED_MODEL_SELECTION_KEY } from './model-selection.js';
import type { ModelSelection, ModelSelectionSource, SeededModelSelection } from './model-selection.js';

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

const seededModelSelectionSchema = z.object({
  modelId: z.string(),
  thinkingLevel: z.custom<ThinkingLevelSetting>(isThinkingLevelSetting).nullable().catch(null),
  source: z.enum(['personal', 'factory']),
});

/** The default pair this thread was seeded with, or null when no default ever seeded it. */
export async function readSeededModelSelection(
  session: Pick<ModelSelectionSession, 'thread'>,
): Promise<SeededModelSelection | null> {
  const parsed = seededModelSelectionSchema.safeParse(
    await session.thread.getSetting({ key: SEEDED_MODEL_SELECTION_KEY }),
  );
  return parsed.success ? parsed.data : null;
}

/**
 * Copy a default pair onto the active thread and record which default it came from.
 * A null thinking level clears the thread override so the Factory fallback applies.
 */
export async function seedModelSelection(
  session: ModelSelectionSession,
  selection: ModelSelection,
  source: ModelSelectionSource,
): Promise<void> {
  if (selection.thinkingLevel) {
    await session.model.switch(selection.modelId, { thinkingLevel: selection.thinkingLevel });
  } else {
    await session.model.switch(selection.modelId);
    await session.state.set({ thinkingLevel: undefined });
  }
  for (const agentType of SUBAGENT_TYPES) {
    await session.subagents.model.set({ modelId: selection.modelId, agentType });
  }
  await session.thread.setSetting({
    key: SEEDED_MODEL_SELECTION_KEY,
    value: { ...selection, source } satisfies SeededModelSelection,
  });
}
