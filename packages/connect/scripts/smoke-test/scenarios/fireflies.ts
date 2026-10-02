import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Fireflies scenario: AskFred thread lifecycle plus the read-only
 * transcript/bites surface. Avoids `delete-transcript` and `upload-audio`
 * since those are destructive or chargeable.
 */
export const firefliesScenario: Scenario = {
  integrationId: 'fireflies',
  summary: 'askfred thread CRUD + transcript/bite reads',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['fireflies_create_askfred_thread', 'fireflies_delete_askfred_thread']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['fireflies_get_user', {}],
          ['fireflies_list_transcripts', { limit: 5 }],
          ['fireflies_list_bites', { limit: 5 }],
          ['fireflies_list_users', { limit: 5 }],
          ['fireflies_list_contacts', { limit: 5 }],
          ['fireflies_list_user_groups', {}],
          ['fireflies_list_askfred_threads', { limit: 5 }],
          ['fireflies_list_active_meetings', {}],
          ['fireflies_get_analytics', {}],
        ],
        tools,
      )),
    );

    let threadId: string | undefined;
    try {
      const thread = await call<{ id: string }>('fireflies_create_askfred_thread', {
        message: `${runId} smoke thread: what are my latest meetings about?`,
      });
      threadId = thread.id;
      steps.push(makeStep('create askfred thread', 'fireflies_create_askfred_thread', 'pass', threadId));
    } catch (error) {
      steps.push(makeStep('create askfred thread', 'fireflies_create_askfred_thread', 'fail', errorMessage(error)));
      return steps;
    }

    if (tools['fireflies_get_askfred_thread']) {
      try {
        await call('fireflies_get_askfred_thread', { id: threadId });
        steps.push(makeStep('read askfred thread', 'fireflies_get_askfred_thread', 'pass'));
      } catch (error) {
        steps.push(makeStep('read askfred thread', 'fireflies_get_askfred_thread', 'fail', errorMessage(error)));
      }
    }

    if (tools['fireflies_continue_askfred_thread']) {
      try {
        await call('fireflies_continue_askfred_thread', {
          id: threadId,
          message: 'and summarize it',
        });
        steps.push(makeStep('continue askfred thread', 'fireflies_continue_askfred_thread', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('continue askfred thread', 'fireflies_continue_askfred_thread', 'fail', errorMessage(error)),
        );
      }
    }

    try {
      await call('fireflies_delete_askfred_thread', { id: threadId });
      steps.push(makeStep('delete askfred thread', 'fireflies_delete_askfred_thread', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke askfred thread ${threadId}`, errorMessage(error));
      steps.push(makeStep('delete askfred thread', 'fireflies_delete_askfred_thread', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
