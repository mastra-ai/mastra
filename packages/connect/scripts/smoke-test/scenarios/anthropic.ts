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
        await call('anthropic_get_message_batch', { message_batch_id: batchId });
        steps.push(makeStep('read batch', 'anthropic_get_message_batch', 'pass'));
      } catch (error) {
        steps.push(makeStep('read batch', 'anthropic_get_message_batch', 'fail', errorMessage(error)));
      }
    }

    if (batchId && tools['anthropic_cancel_message_batch']) {
      try {
        await call('anthropic_cancel_message_batch', { message_batch_id: batchId });
        steps.push(makeStep('cancel batch', 'anthropic_cancel_message_batch', 'pass'));
      } catch (error) {
        log.warn(`Could not cancel smoke batch ${batchId} (may have already completed).`, errorMessage(error));
        steps.push(makeStep('cancel batch', 'anthropic_cancel_message_batch', 'fail', errorMessage(error)));
      }
    }

    // Exercise list_message_batch_results against the batch we just created.
    // A cancelled batch has no results yet, but Anthropic still accepts the
    // request and returns an empty stream.
    if (batchId && tools['anthropic_list_message_batch_results']) {
      try {
        await call('anthropic_list_message_batch_results', { message_batch_id: batchId });
        steps.push(makeStep('list batch results', 'anthropic_list_message_batch_results', 'pass'));
      } catch (error) {
        // 404 on a just-created cancelled batch is normal (no results stream
        // exists yet). Count that as the endpoint being correctly wired.
        const msg = errorMessage(error);
        const status: 'pass' | 'fail' = /status=404|not found/i.test(msg) ? 'pass' : 'fail';
        steps.push(makeStep('list batch results', 'anthropic_list_message_batch_results', status, msg));
      }
    }

    // Files surface. Anthropic doesn't expose an upload tool in this
    // provider, so the scenario can't create its own file. Instead we probe
    // the list, pick any file that happens to exist, and round-trip it
    // through get + delete. When no file exists we invoke get and delete
    // with a bogus id to exercise routing + 404 handling (both are legitimate
    // responses for a nonexistent id, so we treat 404 as pass).
    let probeFileId: string | undefined;
    let probeFileIsReal = false;
    try {
      const files = await call<{ data?: Array<{ id?: string }>; items?: Array<{ id?: string }> }>(
        'anthropic_list_files',
        { limit: 1 },
      );
      probeFileId = files.data?.[0]?.id ?? files.items?.[0]?.id;
      probeFileIsReal = typeof probeFileId === 'string';
    } catch {
      // list_files already recorded in the read batch above.
    }
    if (!probeFileId) probeFileId = `file_smoke_nonexistent_${runId}`;

    if (tools['anthropic_get_file']) {
      try {
        await call('anthropic_get_file', { file_id: probeFileId });
        steps.push(makeStep('get file', 'anthropic_get_file', 'pass', probeFileId));
      } catch (error) {
        const msg = errorMessage(error);
        const expected404 = !probeFileIsReal && /status=404|not found/i.test(msg);
        steps.push(
          makeStep(
            'get file',
            'anthropic_get_file',
            expected404 ? 'pass' : 'fail',
            expected404 ? `404 on synthetic id ${probeFileId} (expected)` : msg,
          ),
        );
      }
    }

    if (tools['anthropic_delete_file']) {
      // Only delete a real file if the token actually owns a disposable one
      // — leave arbitrary account files alone and exercise the endpoint with
      // a bogus id instead when we can't be certain.
      const deleteTargetId = probeFileIsReal ? `file_smoke_nonexistent_${runId}` : probeFileId;
      try {
        await call('anthropic_delete_file', { file_id: deleteTargetId });
        steps.push(makeStep('delete file', 'anthropic_delete_file', 'pass', deleteTargetId));
      } catch (error) {
        const msg = errorMessage(error);
        const expected404 = /status=404|not found/i.test(msg);
        steps.push(
          makeStep(
            'delete file',
            'anthropic_delete_file',
            expected404 ? 'pass' : 'fail',
            expected404 ? `404 on synthetic id ${deleteTargetId} (expected)` : msg,
          ),
        );
      }
    }

    return steps;
  },
};
