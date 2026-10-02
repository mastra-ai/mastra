import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep OpenAI scenario: lightweight model + chat-completion + embedding +
 * moderation smoke, plus a vector-store create/delete cycle. Keeps token spend
 * tiny by using the smallest completion possible and never uploads real files.
 */
export const openaiScenario: Scenario = {
  integrationId: 'openai',
  summary: 'models + chat/embedding/moderation + vector-store lifecycle',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['openai_list_models']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const models = await call<{ items?: Array<{ id?: string }> }>('openai_list_models', {});
    const modelId = models.items?.find(m => m.id?.startsWith('gpt-4o-mini'))?.id ?? models.items?.[0]?.id;
    if (!modelId) {
      steps.push(makeStep('pick model', 'openai_list_models', 'skip', 'No OpenAI models visible.'));
      return steps;
    }
    steps.push(makeStep('pick model', 'openai_list_models', 'pass', modelId));

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['openai_get_model', { modelId }],
          ['openai_list_files', { limit: 5 }],
          ['openai_list_batches', { limit: 5 }],
          ['openai_list_fine_tuning_jobs', { limit: 5 }],
          ['openai_list_vector_stores', { limit: 5 }],
        ],
        tools,
      )),
    );

    if (tools['openai_create_chat_completion']) {
      try {
        await call('openai_create_chat_completion', {
          model: modelId,
          messages: [{ role: 'user', content: 'Reply with ok and stop.' }],
          max_tokens: 8,
        });
        steps.push(makeStep('chat completion', 'openai_create_chat_completion', 'pass'));
      } catch (error) {
        steps.push(makeStep('chat completion', 'openai_create_chat_completion', 'fail', errorMessage(error)));
      }
    }

    if (tools['openai_create_embedding']) {
      try {
        await call('openai_create_embedding', {
          model: 'text-embedding-3-small',
          input: `smoke ${runId}`,
        });
        steps.push(makeStep('create embedding', 'openai_create_embedding', 'pass'));
      } catch (error) {
        steps.push(makeStep('create embedding', 'openai_create_embedding', 'fail', errorMessage(error)));
      }
    }

    if (tools['openai_create_moderation']) {
      try {
        await call('openai_create_moderation', { input: 'hello world' });
        steps.push(makeStep('create moderation', 'openai_create_moderation', 'pass'));
      } catch (error) {
        steps.push(makeStep('create moderation', 'openai_create_moderation', 'fail', errorMessage(error)));
      }
    }

    let vectorStoreId: string | undefined;
    if (tools['openai_create_vector_store']) {
      try {
        const store = await call<{ id: string }>('openai_create_vector_store', {
          name: `smoke-${runId}`,
        });
        vectorStoreId = store.id;
        steps.push(makeStep('create vector store', 'openai_create_vector_store', 'pass', vectorStoreId));
      } catch (error) {
        steps.push(makeStep('create vector store', 'openai_create_vector_store', 'fail', errorMessage(error)));
      }
    }

    if (vectorStoreId && tools['openai_update_vector_store']) {
      try {
        await call('openai_update_vector_store', { vectorStoreId, name: `smoke-${runId}-renamed` });
        steps.push(makeStep('update vector store', 'openai_update_vector_store', 'pass'));
      } catch (error) {
        steps.push(makeStep('update vector store', 'openai_update_vector_store', 'fail', errorMessage(error)));
      }
    }

    if (vectorStoreId && tools['openai_delete_vector_store']) {
      try {
        await call('openai_delete_vector_store', { vectorStoreId });
        steps.push(makeStep('delete vector store', 'openai_delete_vector_store', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke vector store ${vectorStoreId}`, errorMessage(error));
        steps.push(makeStep('delete vector store', 'openai_delete_vector_store', 'fail', errorMessage(error)));
      }
    }

    return steps;
  },
};
