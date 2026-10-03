import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

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
        await call('openai_update_vector_store', { vector_store_id: vectorStoreId, name: `smoke-${runId}-renamed` });
        steps.push(makeStep('update vector store', 'openai_update_vector_store', 'pass'));
      } catch (error) {
        steps.push(makeStep('update vector store', 'openai_update_vector_store', 'fail', errorMessage(error)));
      }
    }

    if (vectorStoreId && tools['openai_get_vector_store']) {
      try {
        await call('openai_get_vector_store', { vector_store_id: vectorStoreId });
        steps.push(makeStep('get vector store', 'openai_get_vector_store', 'pass'));
      } catch (error) {
        steps.push(makeStep('get vector store', 'openai_get_vector_store', 'fail', errorMessage(error)));
      }
    }

    if (vectorStoreId && tools['openai_list_vector_store_files']) {
      try {
        await call('openai_list_vector_store_files', { vector_store_id: vectorStoreId, limit: 5 });
        steps.push(makeStep('list vector store files', 'openai_list_vector_store_files', 'pass'));
      } catch (error) {
        steps.push(makeStep('list vector store files', 'openai_list_vector_store_files', 'fail', errorMessage(error)));
      }
    }

    if (vectorStoreId && tools['openai_search_vector_store']) {
      try {
        await call('openai_search_vector_store', { vector_store_id: vectorStoreId, query: 'smoke test' });
        steps.push(makeStep('search vector store', 'openai_search_vector_store', 'pass'));
      } catch (error) {
        steps.push(makeStep('search vector store', 'openai_search_vector_store', 'fail', errorMessage(error)));
      }
    }

    // Vector-store file CRUD requires a previously uploaded file id. Probe
    // with a synthetic id and accept the 404 as proof the endpoint wires up.
    if (vectorStoreId) {
      steps.push(
        await probeTool(call, tools, 'add vector store file', 'openai_add_vector_store_file', {
          vector_store_id: vectorStoreId,
          file_id: `file-smoke-${runId}`,
        }),
      );
      steps.push(
        await probeTool(call, tools, 'get vector store file', 'openai_get_vector_store_file', {
          vector_store_id: vectorStoreId,
          file_id: `file-smoke-${runId}`,
        }),
      );
      steps.push(
        await probeTool(call, tools, 'delete vector store file', 'openai_delete_vector_store_file', {
          vector_store_id: vectorStoreId,
          file_id: `file-smoke-${runId}`,
        }),
      );
    }

    if (vectorStoreId && tools['openai_delete_vector_store']) {
      try {
        await call('openai_delete_vector_store', { vector_store_id: vectorStoreId });
        steps.push(makeStep('delete vector store', 'openai_delete_vector_store', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke vector store ${vectorStoreId}`, errorMessage(error));
        steps.push(makeStep('delete vector store', 'openai_delete_vector_store', 'fail', errorMessage(error)));
      }
    }

    // Responses API: create a tiny response, read it, delete it.
    let responseId: string | undefined;
    if (tools['openai_create_response']) {
      try {
        const response = await call<{ id?: string }>('openai_create_response', {
          model: modelId,
          input: 'say ok',
        });
        responseId = response.id;
        steps.push(makeStep('create response', 'openai_create_response', responseId ? 'pass' : 'fail', responseId));
      } catch (error) {
        steps.push(makeStep('create response', 'openai_create_response', 'fail', errorMessage(error)));
      }
    }
    if (responseId && tools['openai_get_response']) {
      try {
        await call('openai_get_response', { response_id: responseId });
        steps.push(makeStep('get response', 'openai_get_response', 'pass'));
      } catch (error) {
        steps.push(makeStep('get response', 'openai_get_response', 'fail', errorMessage(error)));
      }
    }
    if (responseId && tools['openai_delete_response']) {
      try {
        await call('openai_delete_response', { response_id: responseId });
        steps.push(makeStep('delete response', 'openai_delete_response', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke response ${responseId}`, errorMessage(error));
        steps.push(makeStep('delete response', 'openai_delete_response', 'fail', errorMessage(error)));
      }
    }

    // Image generation bills real credit, so never let it succeed: probe with
    // a dimension gpt-image-1 does not support. The 400 proves routing +
    // serialization without generating (and paying for) an image.
    steps.push(
      await probeTool(call, tools, 'create image (probe)', 'openai_create_image', {
        prompt: `tiny smoke test tile ${runId}`,
        model: 'gpt-image-1',
        size: '13x7',
        n: 1,
      }),
    );

    // Batch / file / fine-tune tools require a real uploaded file; probe
    // with a synthetic id.
    steps.push(
      await probeTool(call, tools, 'create batch', 'openai_create_batch', {
        input_file_id: `file-smoke-${runId}`,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
      }),
    );
    steps.push(await probeTool(call, tools, 'get batch', 'openai_get_batch', { batch_id: `batch_smoke_${runId}` }));
    steps.push(await probeTool(call, tools, 'get file', 'openai_get_file', { file_id: `file-smoke-${runId}` }));
    steps.push(
      await probeTool(call, tools, 'cancel fine-tuning job', 'openai_cancel_fine_tuning_job', {
        fine_tuning_job_id: `ftjob-smoke-${runId}`,
      }),
    );

    return steps;
  },
};
