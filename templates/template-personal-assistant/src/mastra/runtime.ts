import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ModelRouterLanguageModel } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { AssistantLogger, createObservability } from './observability';
import type { AssistantConfig } from './config';
import { createExecutionBudget } from './execution';
import { createPersonalAssistant } from './agents/personal-assistant';
import { createAssistantServer } from './server';

/** Compose native storage, owner memory, shared model limits, schedules and HTTP protection. */
export function createAssistant(
  config: AssistantConfig,
  model: ConstructorParameters<typeof ModelRouterLanguageModel>[0] = { id: config.model },
  judge: ConstructorParameters<typeof ModelRouterLanguageModel>[0] = { id: config.judgeModel },
) {
  let storage: LibSQLStore;
  try {
    if (config.runtime.mode === 'local') mkdirSync(dirname(config.runtime.databasePath), { recursive: true });
    // TODO: Track https://github.com/mastra-ai/mastra/issues/29885 when upgrading @mastra/libsql.
    // Version 1.29.0 can log raw database errors, stack traces and operation details
    // through a captured default logger, bypassing AssistantLogger sanitization.
    // Restore the strict schedule infrastructure/privacy regression only after a published fix passes it.
    storage = new LibSQLStore({
      id: 'personal-assistant-storage',
      ...(config.runtime.mode === 'local'
        ? { url: `file:${config.runtime.databasePath}` }
        : { url: config.runtime.databaseUrl, authToken: config.runtime.databaseToken }),
    });
  } catch {
    throw new Error('Could not prepare assistant storage. Check ASSISTANT_DATA_DIR or hosted Turso configuration.');
  }
  const memory = new Memory({
    storage,
    options: {
      lastMessages: 40,
      semanticRecall: false,
      observationalMemory: false,
      generateTitle: false,
      workingMemory: {
        enabled: true,
        scope: 'resource',
        template: '# Owner profile\n\n## Preferences\n\n## Relevant long-term context\n',
      },
    },
  });
  const budget = createExecutionBudget(config);
  const { personalAssistant, schedules } = createPersonalAssistant(
    config,
    memory,
    budget.model(model),
    budget.model(judge),
  );
  return new Mastra({
    logger: new AssistantLogger(),
    agents: { personalAssistant },
    storage,
    schedules: schedules.hooks,
    server: createAssistantServer(config, schedules),
    observability: createObservability(config),
  });
}
