import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Resend scenario: audience + contact + segment + topic + template CRUD.
 * The scenario intentionally skips send-email / send-broadcast tools — those
 * mail real recipients and must not run from automated smoke tests.
 */
export const resendScenario: Scenario = {
  integrationId: 'resend',
  summary: 'audience + contact + segment + topic + template CRUD (no sends)',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'resend_create_audience',
      'resend_create_contact',
      'resend_delete_contact',
      'resend_delete_audience',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['resend_list_audiences', {}],
          ['resend_list_domains', {}],
          ['resend_list_templates', {}],
          ['resend_list_topics', {}],
          ['resend_list_webhooks', {}],
          ['resend_list_broadcasts', {}],
        ],
        tools,
      )),
    );

    let audienceId: string | undefined;
    try {
      const audience = await call<{ id: string }>('resend_create_audience', {
        name: `${runId} smoke audience`,
      });
      audienceId = audience.id;
      steps.push(makeStep('create audience', 'resend_create_audience', 'pass', audienceId));
    } catch (error) {
      steps.push(makeStep('create audience', 'resend_create_audience', 'fail', errorMessage(error)));
      return steps;
    }

    if (tools['resend_get_audience']) {
      try {
        await call('resend_get_audience', { audienceId });
        steps.push(makeStep('read audience', 'resend_get_audience', 'pass'));
      } catch (error) {
        steps.push(makeStep('read audience', 'resend_get_audience', 'fail', errorMessage(error)));
      }
    }

    let contactId: string | undefined;
    try {
      const contact = await call<{ id: string }>('resend_create_contact', {
        audienceId,
        email: `smoke+${runId}@mastra-smoke.invalid`,
        firstName: 'Mastra',
        lastName: 'Smoke',
      });
      contactId = contact.id;
      steps.push(makeStep('create contact', 'resend_create_contact', 'pass', contactId));
    } catch (error) {
      steps.push(makeStep('create contact', 'resend_create_contact', 'fail', errorMessage(error)));
    }

    if (contactId && tools['resend_get_contact']) {
      try {
        await call('resend_get_contact', { audienceId, contactId });
        steps.push(makeStep('read contact', 'resend_get_contact', 'pass'));
      } catch (error) {
        steps.push(makeStep('read contact', 'resend_get_contact', 'fail', errorMessage(error)));
      }
    }

    if (contactId && tools['resend_update_contact']) {
      try {
        await call('resend_update_contact', {
          audienceId,
          contactId,
          firstName: 'Mastra-edited',
        });
        steps.push(makeStep('update contact', 'resend_update_contact', 'pass'));
      } catch (error) {
        steps.push(makeStep('update contact', 'resend_update_contact', 'fail', errorMessage(error)));
      }
    }

    let segmentId: string | undefined;
    if (tools['resend_create_segment']) {
      try {
        const segment = await call<{ id: string }>('resend_create_segment', {
          audienceId,
          name: `${runId} smoke segment`,
        });
        segmentId = segment.id;
        steps.push(makeStep('create segment', 'resend_create_segment', 'pass', segmentId));
      } catch (error) {
        steps.push(makeStep('create segment', 'resend_create_segment', 'fail', errorMessage(error)));
      }
    }

    if (segmentId && contactId && tools['resend_add_contact_to_segment']) {
      try {
        await call('resend_add_contact_to_segment', { audienceId, segmentId, contactId });
        steps.push(makeStep('add contact to segment', 'resend_add_contact_to_segment', 'pass'));
      } catch (error) {
        steps.push(makeStep('add contact to segment', 'resend_add_contact_to_segment', 'fail', errorMessage(error)));
      }
    }

    if (segmentId && contactId && tools['resend_remove_contact_from_segment']) {
      try {
        await call('resend_remove_contact_from_segment', { audienceId, segmentId, contactId });
        steps.push(makeStep('remove contact from segment', 'resend_remove_contact_from_segment', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('remove contact from segment', 'resend_remove_contact_from_segment', 'fail', errorMessage(error)),
        );
      }
    }

    let topicId: string | undefined;
    if (tools['resend_create_topic']) {
      try {
        const topic = await call<{ id: string }>('resend_create_topic', {
          name: `${runId} smoke topic`,
        });
        topicId = topic.id;
        steps.push(makeStep('create topic', 'resend_create_topic', 'pass', topicId));
      } catch (error) {
        steps.push(makeStep('create topic', 'resend_create_topic', 'fail', errorMessage(error)));
      }
    }
    if (topicId && tools['resend_delete_topic']) {
      try {
        await call('resend_delete_topic', { topicId });
        steps.push(makeStep('delete topic', 'resend_delete_topic', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke topic ${topicId}`, errorMessage(error));
        steps.push(makeStep('delete topic', 'resend_delete_topic', 'fail', errorMessage(error)));
      }
    }

    if (segmentId && tools['resend_delete_segment']) {
      try {
        await call('resend_delete_segment', { audienceId, segmentId });
        steps.push(makeStep('delete segment', 'resend_delete_segment', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke segment ${segmentId}`, errorMessage(error));
        steps.push(makeStep('delete segment', 'resend_delete_segment', 'fail', errorMessage(error)));
      }
    }

    if (contactId) {
      try {
        await call('resend_delete_contact', { audienceId, contactId });
        steps.push(makeStep('delete contact', 'resend_delete_contact', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke contact ${contactId}`, errorMessage(error));
        steps.push(makeStep('delete contact', 'resend_delete_contact', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('resend_delete_audience', { audienceId });
      steps.push(makeStep('delete audience', 'resend_delete_audience', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke audience ${audienceId}`, errorMessage(error));
      steps.push(makeStep('delete audience', 'resend_delete_audience', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
