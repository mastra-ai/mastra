import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Gmail scenario: label + draft + filter CRUD plus settings reads. The
 * scenario deliberately NEVER sends mail — all drafts are deleted before exit
 * so no outbound traffic hits real recipients.
 */
export const googleMailScenario: Scenario = {
  integrationId: 'google-mail',
  summary: 'label + draft + filter CRUD + settings reads (no sends)',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'google_mail_create_label',
      'google_mail_delete_label',
      'google_mail_create_draft',
      'google_mail_delete_draft',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['google_mail_list_labels', {}],
          ['google_mail_list_filters', {}],
          ['google_mail_list_forwarding_addresses', {}],
          ['google_mail_list_send_as_aliases', {}],
          ['google_mail_get_vacation_settings', {}],
          ['google_mail_get_auto_forwarding_settings', {}],
          ['google_mail_get_imap_settings', {}],
          ['google_mail_get_pop_settings', {}],
          ['google_mail_get_language_settings', {}],
        ],
        tools,
      )),
    );

    let labelId: string | undefined;
    try {
      const label = await call<{ id: string }>('google_mail_create_label', {
        name: `smoke/${runId}`,
      });
      labelId = label.id;
      steps.push(makeStep('create label', 'google_mail_create_label', 'pass', labelId));
    } catch (error) {
      steps.push(makeStep('create label', 'google_mail_create_label', 'fail', errorMessage(error)));
    }

    if (labelId && tools['google_mail_update_label']) {
      try {
        await call('google_mail_update_label', { labelId, name: `smoke/${runId}-renamed` });
        steps.push(makeStep('update label', 'google_mail_update_label', 'pass'));
      } catch (error) {
        steps.push(makeStep('update label', 'google_mail_update_label', 'fail', errorMessage(error)));
      }
    }

    let draftId: string | undefined;
    try {
      const draft = await call<{ id: string }>('google_mail_create_draft', {
        to: 'smoke@mastra-smoke.invalid',
        subject: `${runId} smoke draft`,
        body: 'Automated @mastra/connect smoke test. Never sent.',
      });
      draftId = draft.id;
      steps.push(makeStep('create draft', 'google_mail_create_draft', 'pass', draftId));
    } catch (error) {
      steps.push(makeStep('create draft', 'google_mail_create_draft', 'fail', errorMessage(error)));
    }

    if (draftId && tools['google_mail_get_draft']) {
      try {
        await call('google_mail_get_draft', { draftId });
        steps.push(makeStep('read draft', 'google_mail_get_draft', 'pass'));
      } catch (error) {
        steps.push(makeStep('read draft', 'google_mail_get_draft', 'fail', errorMessage(error)));
      }
    }

    if (draftId && tools['google_mail_update_draft']) {
      try {
        await call('google_mail_update_draft', {
          draftId,
          to: 'smoke@mastra-smoke.invalid',
          subject: `${runId} smoke draft (edited)`,
          body: 'edited',
        });
        steps.push(makeStep('update draft', 'google_mail_update_draft', 'pass'));
      } catch (error) {
        steps.push(makeStep('update draft', 'google_mail_update_draft', 'fail', errorMessage(error)));
      }
    }

    let filterId: string | undefined;
    if (tools['google_mail_create_filter']) {
      try {
        const filter = await call<{ id: string }>('google_mail_create_filter', {
          criteria: { from: `smoke+${runId}@mastra-smoke.invalid` },
          action: { addLabelIds: ['INBOX'] },
        });
        filterId = filter.id;
        steps.push(makeStep('create filter', 'google_mail_create_filter', 'pass', filterId));
      } catch (error) {
        steps.push(makeStep('create filter', 'google_mail_create_filter', 'fail', errorMessage(error)));
      }
    }

    if (filterId && tools['google_mail_get_filter']) {
      try {
        await call('google_mail_get_filter', { filterId });
        steps.push(makeStep('read filter', 'google_mail_get_filter', 'pass'));
      } catch (error) {
        steps.push(makeStep('read filter', 'google_mail_get_filter', 'fail', errorMessage(error)));
      }
    }

    if (filterId && tools['google_mail_delete_filter']) {
      try {
        await call('google_mail_delete_filter', { filterId });
        steps.push(makeStep('delete filter', 'google_mail_delete_filter', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke filter ${filterId}`, errorMessage(error));
        steps.push(makeStep('delete filter', 'google_mail_delete_filter', 'fail', errorMessage(error)));
      }
    }

    if (draftId) {
      try {
        await call('google_mail_delete_draft', { draftId });
        steps.push(makeStep('delete draft', 'google_mail_delete_draft', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke draft ${draftId}`, errorMessage(error));
        steps.push(makeStep('delete draft', 'google_mail_delete_draft', 'fail', errorMessage(error)));
      }
    }

    if (labelId) {
      try {
        await call('google_mail_delete_label', { labelId });
        steps.push(makeStep('delete label', 'google_mail_delete_label', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke label ${labelId}`, errorMessage(error));
        steps.push(makeStep('delete label', 'google_mail_delete_label', 'fail', errorMessage(error)));
      }
    }

    return steps;
  },
};
