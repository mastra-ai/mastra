import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep Fireflies scenario: AskFred thread lifecycle plus every read tool
 * and probes for the destructive / meeting-dependent tools (upload_audio,
 * add_to_live, create_bite, update_meeting_*, etc.). When a real transcript
 * or bite is visible from the list calls, destructive tools are invoked
 * against synthetic ids rather than the real ones so no production data is
 * mutated.
 */
export const firefliesScenario: Scenario = {
  integrationId: 'fireflies',
  summary: 'askfred thread CRUD + full tool surface',
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

    // Probe transcript / bite / channel reads with a synthetic id so we
    // don't need a real recording.
    const syntheticId = `smoke-${runId}`;
    steps.push(await probeTool(call, tools, 'get transcript', 'fireflies_get_transcript', { id: syntheticId }));
    steps.push(await probeTool(call, tools, 'get bite', 'fireflies_get_bite', { id: syntheticId }));
    steps.push(await probeTool(call, tools, 'get channel', 'fireflies_get_channel', { channel_id: syntheticId }));
    steps.push(await probeTool(call, tools, 'delete transcript', 'fireflies_delete_transcript', { id: syntheticId }));
    steps.push(
      await probeTool(call, tools, 'create bite', 'fireflies_create_bite', {
        transcript_id: syntheticId,
        start_time: 0,
        end_time: 5,
        name: `smoke ${runId}`,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'share meeting', 'fireflies_share_meeting', {
        meeting_id: syntheticId,
        emails: [`smoke+${runId}@mastra-smoke.invalid`],
        expiry_days: 7,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'revoke shared meeting access', 'fireflies_revoke_shared_meeting_access', {
        meeting_id: syntheticId,
        email: `smoke+${runId}@mastra-smoke.invalid`,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'update meeting privacy', 'fireflies_update_meeting_privacy', {
        id: syntheticId,
        privacy: 'teammates',
      }),
    );
    steps.push(
      await probeTool(call, tools, 'update meeting channel', 'fireflies_update_meeting_channel', {
        transcript_ids: [syntheticId],
        channel_id: syntheticId,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'update meeting state', 'fireflies_update_meeting_state', {
        meeting_id: syntheticId,
        action: 'pause_recording',
      }),
    );
    // Malformed meeting URL: Fireflies must reject it, so the bot never
    // actually joins a meeting. A valid URL would start a real recording.
    steps.push(
      await probeTool(call, tools, 'add to live', 'fireflies_add_to_live', {
        url: `not-a-meeting-url-${runId}`,
        title: `smoke ${runId}`,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'create live action item', 'fireflies_create_live_action_item', {
        meeting_id: syntheticId,
        prompt: 'Capture open items.',
      }),
    );
    steps.push(
      await probeTool(call, tools, 'create live soundbite', 'fireflies_create_live_soundbite', {
        meeting_id: syntheticId,
        prompt: 'Capture a soundbite for smoke test.',
      }),
    );
    // Malformed audio URL: a fetchable MP3 would kick off a real (billable)
    // transcription that nothing cleans up.
    steps.push(
      await probeTool(call, tools, 'upload audio', 'fireflies_upload_audio', {
        url: `https://invalid.invalid/mastra-smoke-${runId}.mp3`,
        title: `smoke ${runId}`,
      }),
    );

    // AskFred thread lifecycle.
    let threadId: string | undefined;
    try {
      const thread = await call<{ id: string }>('fireflies_create_askfred_thread', {
        query: `${runId} smoke thread: what are my latest meetings about?`,
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
          thread_id: threadId,
          query: 'and summarize it',
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
