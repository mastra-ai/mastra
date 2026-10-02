import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Anthropic scenario: list models, count tokens, send a cheap single-turn
 * message, then exercise the message-batch surface with a one-request batch
 * which is cancelled before billing. Also drives the files inventory tools.
 */
export const anthropicScenario: Scenario = {
  integrationId: 'anthropic',
  summary: 'models + messages + batch lifecycle + files reads',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['anthropic_list_models', 'anthropic_create_message']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const models = await call<{ items?: Array<{ id?: string }> }>('anthropic_list_models', {});
    const modelId = models.items?.[0]?.id;
    if (!modelId) {
      steps.push(makeStep('pick model', 'anthropic_list_models', 'skip', 'No Anthropic models visible.'));
      return steps;
    }
    steps.push(makeStep('pick model', 'anthropic_list_models', 'pass', modelId));

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['anthropic_get_model', { modelId }],
          ['anthropic_list_files', { limit: 5 }],
          ['anthropic_list_message_batches', { limit: 5 }],
        ],
        tools,
      )),
    );

    if (tools['anthropic_count_message_tokens']) {
      try {
        await call('anthropic_count_message_tokens', {
          model: modelId,
          messages: [{ role: 'user', content: `smoke ${runId}` }],
        });
        steps.push(makeStep('count tokens', 'anthropic_count_message_tokens', 'pass'));
      } catch (error) {
        steps.push(makeStep('count tokens', 'anthropic_count_message_tokens', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('anthropic_create_message', {
        model: modelId,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Say "ok" and stop.' }],
      });
      steps.push(makeStep('create message', 'anthropic_create_message', 'pass'));
    } catch (error) {
      steps.push(makeStep('create message', 'anthropic_create_message', 'fail', errorMessage(error)));
    }

    let batchId: string | undefined;
    if (tools['anthropic_create_message_batch']) {
      try {
        const batch = await call<{ id: string }>('anthropic_create_message_batch', {
          requests: [
            {
              custom_id: `smoke-${runId}`,
              params: {
                model: modelId,
                max_tokens: 16,
                messages: [{ role: 'user', content: 'ok' }],
              },
            },
          ],
        });
        batchId = batch.id;
        steps.push(makeStep('create batch', 'anthropic_create_message_batch', 'pass', batchId));
      } catch (error) {
        steps.push(makeStep('create batch', 'anthropic_create_message_batch', 'fail', errorMessage(error)));
      }
    }

    if (batchId && tools['anthropic_get_message_batch']) {
      try {
        await call('anthropic_get_message_batch', { batchId });
        steps.push(makeStep('read batch', 'anthropic_get_message_batch', 'pass'));
      } catch (error) {
        steps.push(makeStep('read batch', 'anthropic_get_message_batch', 'fail', errorMessage(error)));
      }
    }

    if (batchId && tools['anthropic_cancel_message_batch']) {
      try {
        await call('anthropic_cancel_message_batch', { batchId });
        steps.push(makeStep('cancel batch', 'anthropic_cancel_message_batch', 'pass'));
      } catch (error) {
        log.warn(`Could not cancel smoke batch ${batchId} (may have already completed).`, errorMessage(error));
        steps.push(makeStep('cancel batch', 'anthropic_cancel_message_batch', 'fail', errorMessage(error)));
      }
    }

    return steps;
  },
};
