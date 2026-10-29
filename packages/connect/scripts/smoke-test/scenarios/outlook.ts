import process from 'node:process';

import type { Scenario, ScenarioStep } from '../scenario.js';
import { enrichToolError, errorMessage, makeStep, probeTool, requireTools } from '../scenario.js';

const PERSONAL_CAPABILITY_ERROR = /status=(400|401|403|405|501)|not supported|not available|personal|consumer/i;

export const outlookScenario: Scenario = {
  integrationId: 'outlook',
  summary: 'account-aware mail, attachment, folder, calendar, and event lifecycle',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const accountType = process.env.MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE?.trim().toLowerCase();
    const isPersonal = accountType === 'personal';
    steps.push(
      makeStep(
        'account type',
        undefined,
        'pass',
        accountType === 'personal' || accountType === 'work'
          ? accountType
          : 'unknown; set MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE=personal|work for capability classification',
      ),
    );

    const missing = requireTools(tools, [
      'outlook_list_messages',
      'outlook_create_draft_message',
      'outlook_delete_message',
      'outlook_list_calendars',
      'outlook_create_event',
      'outlook_delete_event',
    ]);
    if (missing) {
      steps.push(makeStep('preflight', undefined, 'skip', missing));
      return steps;
    }

    function failedStep(name: string, toolId: string, error: unknown, personalUnsupported = false): ScenarioStep {
      const detail = errorMessage(enrichToolError(toolId, error));
      return makeStep(
        name,
        toolId,
        isPersonal && personalUnsupported && PERSONAL_CAPABILITY_ERROR.test(detail) ? 'skip' : 'fail',
        detail,
      );
    }

    async function attempt(
      name: string,
      toolId: string,
      input: unknown,
      personalUnsupported = false,
    ): Promise<boolean> {
      try {
        await call(toolId, input);
        steps.push(makeStep(name, toolId, 'pass'));
        return true;
      } catch (error) {
        steps.push(failedStep(name, toolId, error, personalUnsupported));
        return false;
      }
    }

    await attempt('list mail folders', 'outlook_list_mail_folders', { limit: 10 });
    await attempt('list inbox child folders', 'outlook_list_mail_folder_children', { folderId: 'inbox', limit: 10 });
    await attempt('list inbox messages', 'outlook_list_messages', { folderId: 'inbox', limit: 5 });

    // There is no delete-mail-folder action in this provider, so prove routing without leaving a persistent folder behind.
    steps.push(
      await probeTool(call, tools, 'create mail folder (probe)', 'outlook_create_mail_folder', {
        parentFolderId: 'mastra-smoke-missing',
        displayName: `${runId}-folder`,
      }),
    );

    let draftId: string | undefined;
    let copiedMessageId: string | undefined;
    let movedMessageId: string | undefined;
    let attachmentId: string | undefined;

    try {
      const draft = await call<{ id: string }>('outlook_create_draft_message', {
        subject: `${runId} Outlook smoke draft`,
        body: { contentType: 'text', content: `@mastra/connect smoke test ${runId}` },
      });
      draftId = draft.id;
      steps.push(makeStep('create draft message', 'outlook_create_draft_message', 'pass', draft.id));
    } catch (error) {
      steps.push(failedStep('create draft message', 'outlook_create_draft_message', error));
    }

    if (draftId) {
      await attempt('get draft message', 'outlook_get_message', { messageId: draftId });
      await attempt('update draft message', 'outlook_update_message', {
        messageId: draftId,
        subject: `${runId} updated Outlook smoke draft`,
        categories: ['Mastra smoke test'],
      });

      try {
        const attachment = await call<{ id: string }>('outlook_add_message_attachment', {
          messageId: draftId,
          fileName: `${runId}.txt`,
          contentType: 'text/plain',
          contentBytes: Buffer.from(`@mastra/connect smoke test ${runId}`).toString('base64'),
        });
        attachmentId = attachment.id;
        steps.push(makeStep('add message attachment', 'outlook_add_message_attachment', 'pass', attachment.id));
      } catch (error) {
        steps.push(failedStep('add message attachment', 'outlook_add_message_attachment', error, true));
      }

      await attempt('list message attachments', 'outlook_list_message_attachments', { messageId: draftId });
      if (attachmentId) {
        await attempt('download message attachment', 'outlook_download_message_attachment', {
          messageId: draftId,
          attachmentId,
        });
      } else {
        // The account could not create the attachment prerequisite, so verify the download route with a synthetic id.
        steps.push(
          await probeTool(call, tools, 'download message attachment (probe)', 'outlook_download_message_attachment', {
            messageId: draftId,
            attachmentId: 'mastra-smoke-missing',
          }),
        );
      }

      try {
        const copied = await call<{ id: string }>('outlook_copy_message', {
          messageId: draftId,
          destinationId: 'drafts',
        });
        copiedMessageId = copied.id;
        steps.push(makeStep('copy draft message', 'outlook_copy_message', 'pass', copied.id));
      } catch (error) {
        steps.push(failedStep('copy draft message', 'outlook_copy_message', error, true));
      }

      if (copiedMessageId) {
        try {
          const moved = await call<{ id: string }>('outlook_move_message', {
            messageId: copiedMessageId,
            destinationId: 'deleteditems',
          });
          movedMessageId = moved.id;
          steps.push(makeStep('move copied message', 'outlook_move_message', 'pass', moved.id));
        } catch (error) {
          steps.push(failedStep('move copied message', 'outlook_move_message', error, true));
        }
      } else {
        // Copying the draft could not produce a real prerequisite, so verify the move route with a synthetic id.
        steps.push(
          await probeTool(
            call,
            tools,
            'move message (probe)',
            'outlook_move_message',
            { messageId: 'mastra-smoke-missing', destinationId: 'deleteditems' },
            isPersonal ? /status=(400|401|403|404|405)|not found|not supported|personal/i : undefined,
          ),
        );
      }
    }

    // Replies require an existing received message; the scenario does not modify real mailbox contents.
    steps.push(
      await probeTool(call, tools, 'reply to message (probe)', 'outlook_reply_to_message', {
        messageId: 'mastra-smoke-missing',
        comment: `@mastra/connect smoke test ${runId}`,
      }),
    );
    // Reply-all has the same received-message prerequisite, so exercise only its routing with a synthetic id.
    steps.push(
      await probeTool(call, tools, 'reply all to message (draft probe)', 'outlook_reply_all_to_message', {
        messageId: 'mastra-smoke-missing',
        comment: `@mastra/connect smoke test ${runId}`,
        createDraft: true,
      }),
    );

    steps.push(makeStep('send mail', 'outlook_send_mail', 'skip', 'Smoke scenarios never send external email.'));
    // Sending a real draft would deliver external mail, so use a synthetic id to verify the route without side effects.
    steps.push(
      await probeTool(call, tools, 'send draft message (probe)', 'outlook_send_draft_message', {
        message_id: 'mastra-smoke-missing',
      }),
    );

    for (const [name, messageId] of [
      ['delete moved message', movedMessageId],
      ['delete copied message', copiedMessageId],
      ['delete draft message', draftId],
    ] as const) {
      if (!messageId) continue;
      try {
        await call('outlook_delete_message', { messageId });
        steps.push(makeStep(name, 'outlook_delete_message', 'pass', messageId));
      } catch (error) {
        const detail = errorMessage(enrichToolError('outlook_delete_message', error));
        if (/status=404|not found/i.test(detail)) {
          steps.push(makeStep(name, 'outlook_delete_message', 'pass', 'already removed by message lifecycle'));
        } else {
          log.error(`Outlook smoke test leaked ${name}`, { messageId, error: detail });
          steps.push(makeStep(name, 'outlook_delete_message', 'fail', detail));
        }
      }
    }

    let calendarId: string | undefined;
    let eventId: string | undefined;
    try {
      const calendars = await call<{ calendars: Array<{ id: string }> }>('outlook_list_calendars', { limit: 10 });
      steps.push(
        makeStep('list calendars', 'outlook_list_calendars', 'pass', `${calendars.calendars.length} returned`),
      );
    } catch (error) {
      steps.push(failedStep('list calendars', 'outlook_list_calendars', error));
    }

    try {
      const calendar = await call<{ id: string }>('outlook_create_calendar', {
        name: `${runId} Outlook smoke calendar`,
        color: 'lightBlue',
      });
      calendarId = calendar.id;
      steps.push(makeStep('create calendar', 'outlook_create_calendar', 'pass', calendar.id));
    } catch (error) {
      steps.push(failedStep('create calendar', 'outlook_create_calendar', error));
    }

    if (calendarId) {
      await attempt('get calendar', 'outlook_get_calendar', { calendarId });
      await attempt('update calendar', 'outlook_update_calendar', {
        calendarId,
        name: `${runId} updated Outlook smoke calendar`,
        color: 'lightGreen',
      });

      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      try {
        const event = await call<{ id: string }>('outlook_create_event', {
          calendarId,
          subject: `${runId} Outlook smoke event`,
          start: { dateTime: start.toISOString().replace(/Z$/, ''), timeZone: 'UTC' },
          end: { dateTime: end.toISOString().replace(/Z$/, ''), timeZone: 'UTC' },
          body: { contentType: 'text', content: `@mastra/connect smoke test ${runId}` },
          showAs: 'free',
        });
        eventId = event.id;
        steps.push(makeStep('create event', 'outlook_create_event', 'pass', event.id));
      } catch (error) {
        steps.push(failedStep('create event', 'outlook_create_event', error));
      }
    }

    if (eventId) {
      await attempt('get event', 'outlook_get_event', { eventId, timezone: 'UTC' });
      await attempt('list calendar events', 'outlook_list_calendar_events', { calendar_id: calendarId, top: 10 });
      await attempt('update event', 'outlook_update_event', {
        eventId,
        subject: `${runId} updated Outlook smoke event`,
      });
      await attempt(
        'add event attachment',
        'outlook_add_event_attachment',
        {
          eventId,
          name: `${runId}.txt`,
          contentType: 'text/plain',
          contentBytes: Buffer.from(`@mastra/connect smoke test ${runId}`).toString('base64'),
        },
        true,
      );
      await attempt('list event attachments', 'outlook_list_event_attachments', { eventId });
      await attempt(
        'cancel event',
        'outlook_cancel_event',
        { eventId, comment: `@mastra/connect smoke test ${runId}` },
        true,
      );

      try {
        await call('outlook_delete_event', { event_id: eventId, calendar_id: calendarId });
        steps.push(makeStep('delete event', 'outlook_delete_event', 'pass', eventId));
      } catch (error) {
        const detail = errorMessage(enrichToolError('outlook_delete_event', error));
        if (/status=404|not found/i.test(detail)) {
          steps.push(makeStep('delete event', 'outlook_delete_event', 'pass', 'removed by cancellation'));
        } else {
          log.error('Outlook smoke test leaked event', { eventId, error: detail });
          steps.push(makeStep('delete event', 'outlook_delete_event', 'fail', detail));
        }
      }
    } else {
      // Event creation could not produce a real prerequisite, so verify list routing with a synthetic calendar id.
      steps.push(
        await probeTool(call, tools, 'list calendar events (probe)', 'outlook_list_calendar_events', {
          calendar_id: 'mastra-smoke-missing',
          top: 1,
        }),
      );
    }

    if (calendarId) {
      try {
        await call('outlook_delete_calendar', { calendarId });
        steps.push(makeStep('delete calendar', 'outlook_delete_calendar', 'pass', calendarId));
      } catch (error) {
        const detail = errorMessage(error);
        log.error('Outlook smoke test leaked calendar', { calendarId, error: detail });
        steps.push(makeStep('delete calendar', 'outlook_delete_calendar', 'fail', detail));
      }
    }

    return steps;
  },
};
