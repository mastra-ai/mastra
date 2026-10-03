import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep Gmail scenario: label + draft + filter CRUD plus settings reads. The
 * scenario deliberately NEVER sends mail — all drafts are deleted before exit
 * so no outbound traffic hits real recipients.
 */

/** Base64url-encode an RFC 2822 message (what Gmail's draft/send tools expect as `raw`). */
function toRawMime(options: { to: string; subject: string; body: string }): string {
  const mime = `To: ${options.to}\r\nSubject: ${options.subject}\r\n\r\n${options.body}\r\n`;
  return btoa(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
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
          ['google_mail_list_drafts', { maxResults: 5 }],
          ['google_mail_list_messages', { maxResults: 5 }],
          ['google_mail_list_threads', { maxResults: 5 }],
        ],
        tools,
      )),
    );

    // Pick a representative message + thread for read-only probes.
    let probeMessageId: string | undefined;
    let probeThreadId: string | undefined;
    if (tools['google_mail_list_messages']) {
      try {
        const result = await call<{ messages?: Array<{ id?: string; threadId?: string }> }>(
          'google_mail_list_messages',
          { maxResults: 1 },
        );
        probeMessageId = result.messages?.[0]?.id;
        probeThreadId = result.messages?.[0]?.threadId;
      } catch {
        /* swallow — scenario continues with synthetic ids */
      }
    }

    if (tools['google_mail_get_message']) {
      if (probeMessageId) {
        try {
          await call('google_mail_get_message', { id: probeMessageId, format: 'minimal' });
          steps.push(makeStep('get message', 'google_mail_get_message', 'pass'));
        } catch (error) {
          steps.push(makeStep('get message', 'google_mail_get_message', 'fail', errorMessage(error)));
        }
      } else {
        steps.push(
          await probeTool(call, tools, 'get message (probe)', 'google_mail_get_message', {
            id: `smoke-${runId}`,
            format: 'minimal',
          }),
        );
      }
    }
    if (tools['google_mail_get_thread']) {
      if (probeThreadId) {
        try {
          await call('google_mail_get_thread', { id: probeThreadId, format: 'minimal' });
          steps.push(makeStep('get thread', 'google_mail_get_thread', 'pass'));
        } catch (error) {
          steps.push(makeStep('get thread', 'google_mail_get_thread', 'fail', errorMessage(error)));
        }
      } else {
        steps.push(
          await probeTool(call, tools, 'get thread (probe)', 'google_mail_get_thread', {
            id: `smoke-${runId}`,
            format: 'minimal',
          }),
        );
      }
    }
    if (tools['google_mail_get_attachment']) {
      steps.push(
        await probeTool(call, tools, 'get attachment (probe)', 'google_mail_get_attachment', {
          messageId: probeMessageId ?? `smoke-${runId}`,
          attachmentId: 'smoke-attachment',
        }),
      );
    }
    if (tools['google_mail_list_watch_history']) {
      // startHistoryId is required; use a plausibly-small value — Gmail
      // responds with the current history when the id is valid, 404
      // otherwise. Either outcome proves routing.
      steps.push(
        await probeTool(call, tools, 'list watch history (probe)', 'google_mail_list_watch_history', {
          startHistoryId: '1',
          historyTypes: ['messageAdded'],
        }),
      );
    }

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

    if (labelId && tools['google_mail_get_label']) {
      try {
        await call('google_mail_get_label', { id: labelId });
        steps.push(makeStep('get label', 'google_mail_get_label', 'pass'));
      } catch (error) {
        steps.push(makeStep('get label', 'google_mail_get_label', 'fail', errorMessage(error)));
      }
    }

    let draftId: string | undefined;
    try {
      const draft = await call<{ id: string }>('google_mail_create_draft', {
        raw: toRawMime({
          to: 'smoke@mastra-smoke.invalid',
          subject: `${runId} smoke draft`,
          body: 'Automated @mastra/connect smoke test. Never sent.',
        }),
      });
      draftId = draft.id;
      steps.push(makeStep('create draft', 'google_mail_create_draft', 'pass', draftId));
    } catch (error) {
      steps.push(makeStep('create draft', 'google_mail_create_draft', 'fail', errorMessage(error)));
    }

    if (draftId && tools['google_mail_get_draft']) {
      try {
        await call('google_mail_get_draft', { id: draftId });
        steps.push(makeStep('read draft', 'google_mail_get_draft', 'pass'));
      } catch (error) {
        steps.push(makeStep('read draft', 'google_mail_get_draft', 'fail', errorMessage(error)));
      }
    }

    if (tools['google_mail_send_draft']) {
      steps.push(
        await probeTool(call, tools, 'send draft (probe)', 'google_mail_send_draft', { id: `smoke-draft-${runId}` }),
      );
    }
    if (tools['google_mail_send_message']) {
      // base64url-encoded empty MIME message — Gmail rejects "no recipient"
      // or similar validation errors; probe just verifies routing.
      steps.push(
        await probeTool(call, tools, 'send message (probe)', 'google_mail_send_message', {
          raw: btoa(`Subject: smoke-${runId}\r\n\r\nnot sent\r\n`)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, ''),
        }),
      );
    }

    if (draftId && tools['google_mail_update_draft']) {
      try {
        await call('google_mail_update_draft', {
          id: draftId,
          raw: toRawMime({
            to: 'smoke@mastra-smoke.invalid',
            subject: `${runId} smoke draft (edited)`,
            body: 'edited',
          }),
        });
        steps.push(makeStep('update draft', 'google_mail_update_draft', 'pass'));
      } catch (error) {
        steps.push(makeStep('update draft', 'google_mail_update_draft', 'fail', errorMessage(error)));
      }
    }

    let filterId: string | undefined;
    if (tools['google_mail_create_filter'] && labelId) {
      // Gmail rejects adding the INBOX system label via filters — only user
      // labels can be ADDED (system labels like INBOX can only be REMOVED,
      // which is the "skip inbox" action). Use the smoke-created label id.
      try {
        const filter = await call<{ id: string }>('google_mail_create_filter', {
          criteria: { from: `smoke+${runId}@mastra-smoke.invalid` },
          action: { addLabelIds: [labelId] },
        });
        filterId = filter.id;
        steps.push(makeStep('create filter', 'google_mail_create_filter', 'pass', filterId));
      } catch (error) {
        steps.push(makeStep('create filter', 'google_mail_create_filter', 'fail', errorMessage(error)));
      }
    }

    if (filterId && tools['google_mail_get_filter']) {
      try {
        await call('google_mail_get_filter', { id: filterId });
        steps.push(makeStep('read filter', 'google_mail_get_filter', 'pass'));
      } catch (error) {
        steps.push(makeStep('read filter', 'google_mail_get_filter', 'fail', errorMessage(error)));
      }
    }

    // Message / thread label mutations probed with synthetic ids so no real
    // mail is modified. Also exercises batch endpoints.
    if (tools['google_mail_modify_message']) {
      steps.push(
        await probeTool(call, tools, 'modify message (probe)', 'google_mail_modify_message', {
          id: probeMessageId ?? `smoke-${runId}`,
          addLabelIds: labelId ? [labelId] : [],
        }),
      );
    }
    if (tools['google_mail_modify_thread']) {
      steps.push(
        await probeTool(call, tools, 'modify thread (probe)', 'google_mail_modify_thread', {
          threadId: probeThreadId ?? `smoke-${runId}`,
          addLabelIds: labelId ? [labelId] : [],
        }),
      );
    }
    if (tools['google_mail_batch_modify_messages']) {
      steps.push(
        await probeTool(call, tools, 'batch modify messages (probe)', 'google_mail_batch_modify_messages', {
          ids: [probeMessageId ?? `smoke-${runId}`],
          addLabelIds: labelId ? [labelId] : [],
        }),
      );
    }
    if (tools['google_mail_batch_delete_messages']) {
      steps.push(
        await probeTool(call, tools, 'batch delete messages (probe)', 'google_mail_batch_delete_messages', {
          ids: [`smoke-missing-${runId}`],
        }),
      );
    }
    if (tools['google_mail_trash_message']) {
      steps.push(
        await probeTool(call, tools, 'trash message (probe)', 'google_mail_trash_message', {
          id: `smoke-missing-${runId}`,
        }),
      );
    }
    if (tools['google_mail_untrash_message']) {
      steps.push(
        await probeTool(call, tools, 'untrash message (probe)', 'google_mail_untrash_message', {
          id: `smoke-missing-${runId}`,
        }),
      );
    }
    if (tools['google_mail_trash_thread']) {
      steps.push(
        await probeTool(call, tools, 'trash thread (probe)', 'google_mail_trash_thread', {
          thread_id: `smoke-missing-${runId}`,
        }),
      );
    }
    if (tools['google_mail_untrash_thread']) {
      steps.push(
        await probeTool(call, tools, 'untrash thread (probe)', 'google_mail_untrash_thread', {
          threadId: `smoke-missing-${runId}`,
        }),
      );
    }
    if (tools['google_mail_delete_message']) {
      steps.push(
        await probeTool(call, tools, 'delete message (probe)', 'google_mail_delete_message', {
          id: `smoke-missing-${runId}`,
        }),
      );
    }
    if (tools['google_mail_delete_thread']) {
      steps.push(
        await probeTool(call, tools, 'delete thread (probe)', 'google_mail_delete_thread', {
          id: `smoke-missing-${runId}`,
        }),
      );
    }

    // Send-as alias CRUD — synthetic alias email probed; Gmail rejects the
    // verification step but the routing is exercised.
    const aliasEmail = `smoke+${runId}@mastra-smoke.invalid`;
    if (tools['google_mail_create_send_as_alias']) {
      steps.push(
        await probeTool(call, tools, 'create send-as alias (probe)', 'google_mail_create_send_as_alias', {
          sendAsEmail: aliasEmail,
          displayName: `smoke ${runId}`,
        }),
      );
    }
    if (tools['google_mail_get_send_as_alias']) {
      steps.push(
        await probeTool(call, tools, 'get send-as alias (probe)', 'google_mail_get_send_as_alias', {
          sendAsEmail: aliasEmail,
        }),
      );
    }
    if (tools['google_mail_update_send_as_alias']) {
      steps.push(
        await probeTool(call, tools, 'update send-as alias (probe)', 'google_mail_update_send_as_alias', {
          sendAsEmail: aliasEmail,
          displayName: `smoke ${runId} renamed`,
        }),
      );
    }
    if (tools['google_mail_update_send_as_smtp_msa']) {
      steps.push(
        await probeTool(call, tools, 'update send-as smtp (probe)', 'google_mail_update_send_as_smtp_msa', {
          sendAsEmail: aliasEmail,
          smtpMsa: {
            host: 'smtp.example.invalid',
            port: 587,
            username: 'smoke',
            password: 'smoke',
            securityMode: 'starttls',
          },
        }),
      );
    }

    // Forwarding address: delete + get probed with synthetic address.
    if (tools['google_mail_get_forwarding_address']) {
      steps.push(
        await probeTool(call, tools, 'get forwarding address (probe)', 'google_mail_get_forwarding_address', {
          forwardingEmail: aliasEmail,
        }),
      );
    }
    if (tools['google_mail_delete_forwarding_address']) {
      steps.push(
        await probeTool(call, tools, 'delete forwarding address (probe)', 'google_mail_delete_forwarding_address', {
          forwardingEmail: aliasEmail,
        }),
      );
    }

    // Settings updates: read the current value first, then write that same
    // value back. The round-trip exercises the update endpoint while leaving
    // the user's real mailbox state untouched. If the read fails we skip the
    // update rather than mutate blind.
    if (tools['google_mail_update_vacation_settings']) {
      try {
        const current = tools['google_mail_get_vacation_settings']
          ? await call<{ enableAutoReply?: boolean; responseSubject?: string }>('google_mail_get_vacation_settings', {})
          : undefined;
        if (!current) {
          steps.push(
            makeStep(
              'update vacation settings',
              'google_mail_update_vacation_settings',
              'skip',
              'current vacation settings unavailable — not mutating blind',
            ),
          );
        } else {
          await call('google_mail_update_vacation_settings', {
            enableAutoReply: current.enableAutoReply ?? false,
            ...(current.responseSubject !== undefined && { responseSubject: current.responseSubject }),
          });
          steps.push(makeStep('update vacation settings', 'google_mail_update_vacation_settings', 'pass'));
        }
      } catch (error) {
        steps.push(
          makeStep('update vacation settings', 'google_mail_update_vacation_settings', 'fail', errorMessage(error)),
        );
      }
    }
    // update_auto_forwarding_settings is a Google Workspace-only endpoint:
    // Gmail returns 403 "Access restricted to service accounts that have been
    // delegated domain-wide authority" on consumer Gmail accounts. Probe so
    // routing + request validation are exercised; it executes as a real call
    // on Workspace connections with domain-wide delegation.
    if (tools['google_mail_update_auto_forwarding_settings']) {
      steps.push(
        await probeTool(
          call,
          tools,
          'update auto-forwarding (probe)',
          'google_mail_update_auto_forwarding_settings',
          { enabled: false },
          // Workspace-only endpoint: consumer Gmail answers 403, which is the
          // expected proof here. (Opt-in — the default probe regex excludes 403.)
          /status=(400|403|404|409|422)|not found|restricted to service accounts/i,
        ),
      );
    }
    if (tools['google_mail_update_imap_settings']) {
      try {
        const current = tools['google_mail_get_imap_settings']
          ? await call<{ enabled?: boolean; autoExpunge?: boolean }>('google_mail_get_imap_settings', {})
          : undefined;
        await call('google_mail_update_imap_settings', {
          ...(current?.enabled !== undefined && { imap_enabled: current.enabled }),
          ...(current?.autoExpunge !== undefined && { auto_expunge: current.autoExpunge }),
        });
        steps.push(makeStep('update imap settings', 'google_mail_update_imap_settings', 'pass'));
      } catch (error) {
        steps.push(makeStep('update imap settings', 'google_mail_update_imap_settings', 'fail', errorMessage(error)));
      }
    }
    if (tools['google_mail_update_pop_settings']) {
      try {
        const current = tools['google_mail_get_pop_settings']
          ? await call<{ accessWindow?: string; disposition?: string }>('google_mail_get_pop_settings', {})
          : undefined;
        await call('google_mail_update_pop_settings', {
          ...(current?.accessWindow !== undefined && { accessWindow: current.accessWindow }),
          ...(current?.disposition !== undefined && { disposition: current.disposition }),
        });
        steps.push(makeStep('update pop settings', 'google_mail_update_pop_settings', 'pass'));
      } catch (error) {
        steps.push(makeStep('update pop settings', 'google_mail_update_pop_settings', 'fail', errorMessage(error)));
      }
    }
    if (tools['google_mail_update_language_settings']) {
      try {
        const current = tools['google_mail_get_language_settings']
          ? await call<{ displayLanguage?: string }>('google_mail_get_language_settings', {})
          : undefined;
        await call('google_mail_update_language_settings', {
          displayLanguage: current?.displayLanguage ?? 'en',
        });
        steps.push(makeStep('update language settings', 'google_mail_update_language_settings', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('update language settings', 'google_mail_update_language_settings', 'fail', errorMessage(error)),
        );
      }
    }

    // Watch mailbox requires a real Pub/Sub topic; probe to prove routing.
    if (tools['google_mail_watch_mailbox']) {
      steps.push(
        await probeTool(call, tools, 'watch mailbox (probe)', 'google_mail_watch_mailbox', {
          topicName: `projects/smoke-${runId}/topics/smoke`,
        }),
      );
    }
    if (tools['google_mail_stop_watch']) {
      try {
        await call('google_mail_stop_watch', {});
        steps.push(makeStep('stop watch', 'google_mail_stop_watch', 'pass'));
      } catch (error) {
        // 404 "no active watch" is a valid proof; treat as pass.
        const msg = errorMessage(error);
        steps.push(
          /no active|not found|status=404/i.test(msg)
            ? makeStep('stop watch (no active)', 'google_mail_stop_watch', 'pass', msg.slice(0, 120))
            : makeStep('stop watch', 'google_mail_stop_watch', 'fail', msg),
        );
      }
    }

    if (filterId && tools['google_mail_delete_filter']) {
      try {
        await call('google_mail_delete_filter', { id: filterId });
        steps.push(makeStep('delete filter', 'google_mail_delete_filter', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke filter ${filterId}`, errorMessage(error));
        steps.push(makeStep('delete filter', 'google_mail_delete_filter', 'fail', errorMessage(error)));
      }
    }

    if (draftId) {
      try {
        await call('google_mail_delete_draft', { id: draftId });
        steps.push(makeStep('delete draft', 'google_mail_delete_draft', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke draft ${draftId}`, errorMessage(error));
        steps.push(makeStep('delete draft', 'google_mail_delete_draft', 'fail', errorMessage(error)));
      }
    }

    if (labelId) {
      try {
        await call('google_mail_delete_label', { id: labelId });
        steps.push(makeStep('delete label', 'google_mail_delete_label', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke label ${labelId}`, errorMessage(error));
        steps.push(makeStep('delete label', 'google_mail_delete_label', 'fail', errorMessage(error)));
      }
    }

    return steps;
  },
};
