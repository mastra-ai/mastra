import type { Scenario, ScenarioStep } from '../scenario.js';
import { errorMessage, makeStep, probeTool, requireTools, runReadBatch } from '../scenario.js';

/**
 * SendGrid scenario. Nothing here delivers mail:
 *
 * - `sendgrid_send_mail` always runs with `mail_settings.sandbox_mode` on, so
 *   SendGrid validates the message and returns 200 without delivering it. The
 *   from address is the first verified sender identity; with none, the call
 *   is probed and SendGrid's sender-verification rejection counts as the
 *   endpoint answering.
 * - Creating a sender identity makes SendGrid email a verification link to
 *   the from address, so the sender lifecycle only runs against a mailbox you
 *   own: set `MASTRA_SMOKE_SENDGRID_SENDER_EMAIL`. Otherwise create is skipped
 *   and update/delete are probed with a synthetic id. The verification resend
 *   is always probed so a run never sends a second email.
 * - Every other record (lists, contacts, custom fields, segments, templates
 *   and versions, suppression groups, global and group suppressions) is
 *   created with a `<runId>` name or a `<runId>@example.com` address and
 *   deleted in `finally`.
 * - Block, bounce, invalid-email, and spam-report deletes name only the
 *   run's own address, which is never on those lists. They never use
 *   `delete_all`.
 */

const SYNTHETIC_ID = '99999999';
/** Contact search is eventually consistent; new contacts can take minutes to index. */
const CONTACT_SEARCH_TIMEOUT_MS = 180_000;
const CONTACT_SEARCH_INTERVAL_MS = 10_000;

export const sendgridScenario: Scenario = {
  integrationId: 'sendgrid',
  summary:
    'list/contact/segment/custom-field/template/suppression CRUD, sandboxed send, suppression-list reads + scoped deletes',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['sendgrid_create_list', 'sendgrid_delete_list', 'sendgrid_delete_contacts']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const email = `${runId}@example.com`;
    const fieldName = runId.replace(/-/g, '_');

    /** Runs one tool call as a step; returns the output, or undefined on failure/skip. */
    async function step<T>(name: string, toolId: string, input: unknown, detail?: (out: T) => string | undefined) {
      if (!tools[toolId]) {
        steps.push(makeStep(name, toolId, 'skip', 'tool not in project toolset'));
        return undefined;
      }
      try {
        const out = await call<T>(toolId, input);
        steps.push(makeStep(name, toolId, 'pass', detail?.(out)));
        return out;
      } catch (error) {
        steps.push(makeStep(name, toolId, 'fail', errorMessage(error)));
        return undefined;
      }
    }

    /** Cleanup step: a failure means a leaked record, so it is logged as well as failed. */
    async function cleanup(name: string, toolId: string, input: unknown, leak: string) {
      try {
        await call(toolId, input);
        steps.push(makeStep(name, toolId, 'pass'));
      } catch (error) {
        log.error(`sendgrid smoke leaked ${leak}`, { error: errorMessage(error) });
        steps.push(makeStep(name, toolId, 'fail', `leaked ${leak}: ${errorMessage(error)}`));
      }
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['sendgrid_get_stats', { start_date: weekAgo, aggregated_by: 'day' }],
          ['sendgrid_get_contacts_count', {}],
          ['sendgrid_list_contacts', {}],
          ['sendgrid_list_custom_fields', {}],
          ['sendgrid_list_lists', {}],
          ['sendgrid_list_segments', {}],
          ['sendgrid_list_dynamic_templates', { page_size: 5 }],
          ['sendgrid_list_suppression_groups', {}],
          ['sendgrid_list_global_suppressions', { limit: 5 }],
          ['sendgrid_list_blocks', { limit: 5 }],
          ['sendgrid_list_bounces', { limit: 5 }],
          ['sendgrid_list_invalid_emails', { limit: 5 }],
          ['sendgrid_list_spam_reports', { limit: 5 }],
        ],
        tools,
      )),
    );

    // Suppression lists the run can't add to: delete only the run's own address.
    steps.push(
      await probeTool(call, tools, 'delete blocks (run address only)', 'sendgrid_delete_blocks', { emails: [email] }),
      await probeTool(call, tools, 'delete bounces (run address only)', 'sendgrid_delete_bounces', { emails: [email] }),
      await probeTool(call, tools, 'delete invalid emails (run address only)', 'sendgrid_delete_invalid_emails', {
        emails: [email],
      }),
      await probeTool(call, tools, 'delete spam reports (run address only)', 'sendgrid_delete_spam_reports', {
        emails: [email],
      }),
    );

    // Sender identities, then a sandboxed send from a verified sender.
    const senders = await step<{ results: Array<{ id: number; from_email: string; verified?: boolean }> }>(
      'list sender identities',
      'sendgrid_list_sender_identities',
      { limit: 50 },
      out => `${out.results.length} senders`,
    );
    const senderEmail = process.env.MASTRA_SMOKE_SENDGRID_SENDER_EMAIL;
    if (senderEmail) {
      const sender = await step<{ id: number }>('create sender identity', 'sendgrid_create_sender_identity', {
        nickname: runId,
        from_email: senderEmail,
        from_name: runId,
        reply_to: senderEmail,
        address: '1 Smoke Test Way',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        country: 'United States',
      });
      if (sender) {
        try {
          await step('update sender identity', 'sendgrid_update_sender_identity', {
            sender_id: sender.id,
            nickname: `${runId}-updated`,
          });
        } finally {
          await cleanup(
            'delete sender identity',
            'sendgrid_delete_sender_identity',
            { sender_id: String(sender.id) },
            `sender identity ${sender.id}`,
          );
        }
      }
    } else {
      steps.push(
        makeStep(
          'create sender identity',
          'sendgrid_create_sender_identity',
          'skip',
          'creating a sender emails a verification link; set MASTRA_SMOKE_SENDGRID_SENDER_EMAIL to a mailbox you own',
        ),
        await probeTool(call, tools, 'update sender identity (probe)', 'sendgrid_update_sender_identity', {
          sender_id: Number(SYNTHETIC_ID),
          nickname: runId,
        }),
        await probeTool(call, tools, 'delete sender identity (probe)', 'sendgrid_delete_sender_identity', {
          sender_id: SYNTHETIC_ID,
        }),
      );
    }
    steps.push(
      await probeTool(call, tools, 'resend sender verification (probe)', 'sendgrid_resend_sender_verification', {
        sender_id: SYNTHETIC_ID,
      }),
    );

    const verifiedFrom = senders?.results.find(s => s.verified)?.from_email;
    const mail = {
      personalizations: [{ to: [{ email }], subject: `${runId} sandbox` }],
      from: { email: verifiedFrom ?? email },
      content: [{ type: 'text/plain', value: `${runId}: sandbox mode, never delivered.` }],
      mail_settings: { sandbox_mode: { enable: true } },
    };
    if (verifiedFrom) {
      await step<{ accepted: boolean }>('send mail (sandbox)', 'sendgrid_send_mail', mail, out =>
        out.accepted ? 'accepted in sandbox mode' : 'not accepted',
      );
    } else {
      steps.push(
        await probeTool(
          call,
          tools,
          'send mail (sandbox, no verified sender)',
          'sendgrid_send_mail',
          mail,
          /status=(400|403)|verified Sender/i,
        ),
      );
    }

    // Global and group suppressions for the run's address.
    if (await step('add global suppression', 'sendgrid_add_global_suppressions', { recipient_emails: [email] })) {
      await cleanup('delete global suppression', 'sendgrid_delete_global_suppression', { email }, `global ${email}`);
    }

    const group = await step<{ id: number }>('create suppression group', 'sendgrid_create_suppression_group', {
      name: runId,
      description: `${runId} smoke test`,
    });
    if (group) {
      try {
        await step('update suppression group', 'sendgrid_update_suppression_group', {
          group_id: group.id,
          description: `${runId} smoke test (updated)`,
        });
        if (
          await step('add group suppression', 'sendgrid_add_group_suppressions', {
            group_id: group.id,
            recipient_emails: [email],
          })
        ) {
          await step<{ emails: string[] }>(
            'list group suppressions',
            'sendgrid_list_group_suppressions',
            { group_id: String(group.id) },
            out => (out.emails.includes(email) ? 'run address present' : 'run address missing'),
          );
          await step('delete group suppression', 'sendgrid_delete_group_suppression', { group_id: group.id, email });
        }
      } finally {
        await cleanup(
          'delete suppression group',
          'sendgrid_delete_suppression_group',
          { group_id: group.id },
          `suppression group ${group.id}`,
        );
      }
    }

    // Custom field.
    const field = await step<{ id: string }>('create custom field', 'sendgrid_create_custom_field', {
      name: fieldName,
      field_type: 'Text',
    });
    if (field) {
      await cleanup(
        'delete custom field',
        'sendgrid_delete_custom_field',
        { custom_field_id: field.id },
        `custom field ${field.id}`,
      );
    }

    // Dynamic template with two versions, so the inactive one can be deleted.
    const template = await step<{ id: string }>('create dynamic template', 'sendgrid_create_dynamic_template', {
      name: runId,
    });
    if (template) {
      try {
        await step('get dynamic template', 'sendgrid_get_dynamic_template', { template_id: template.id });
        await step('update dynamic template', 'sendgrid_update_dynamic_template', {
          templateId: template.id,
          name: `${runId}-updated`,
        });
        const v1 = await step<{ id: string }>('create template version', 'sendgrid_create_template_version', {
          template_id: template.id,
          name: `${runId}-v1`,
          subject: `${runId} v1`,
          plain_content: 'v1',
          active: 1,
        });
        const v2 = await step<{ id: string }>('create second template version', 'sendgrid_create_template_version', {
          template_id: template.id,
          name: `${runId}-v2`,
          subject: `${runId} v2`,
          plain_content: 'v2',
          active: 0,
        });
        if (v2) {
          await step('update template version', 'sendgrid_update_template_version', {
            template_id: template.id,
            version_id: v2.id,
            subject: `${runId} v2 (updated)`,
          });
          await step('activate template version', 'sendgrid_activate_template_version', {
            template_id: template.id,
            version_id: v2.id,
          });
        }
        if (v1 && v2) {
          await step('delete inactive template version', 'sendgrid_delete_template_version', {
            template_id: template.id,
            version_id: v1.id,
          });
        }
      } finally {
        await cleanup(
          'delete dynamic template',
          'sendgrid_delete_dynamic_template',
          { template_id: template.id },
          `template ${template.id}`,
        );
      }
    }

    // List → contact → segment.
    const list = await step<{ id: string }>('create list', 'sendgrid_create_list', { name: runId });
    let contactId: string | undefined;
    let contactWritten = false;
    try {
      if (list) await step('get list', 'sendgrid_get_list', { list_id: list.id });

      contactWritten = !!(await step<{ status: string }>(
        'upsert contact',
        'sendgrid_upsert_contacts',
        { contacts: [{ email, first_name: runId }] },
        out => `import ${out.status}`,
      ));
      if (list) {
        contactWritten =
          !!(await step('add contact to list', 'sendgrid_add_contacts_to_list', {
            list_id: list.id,
            contacts: [{ email }],
          })) || contactWritten;
      }

      if (contactWritten && tools['sendgrid_search_contacts']) {
        const started = Date.now();
        let lastError: string | undefined;
        while (!contactId && Date.now() - started < CONTACT_SEARCH_TIMEOUT_MS) {
          try {
            const found = await call<{ contacts: Array<{ id: string; email?: string }> }>('sendgrid_search_contacts', {
              query: `email = '${email}'`,
            });
            contactId = found.contacts.find(c => c.email === email)?.id;
            lastError = undefined;
          } catch (error) {
            lastError = errorMessage(error);
          }
          if (!contactId) await new Promise(resolve => setTimeout(resolve, CONTACT_SEARCH_INTERVAL_MS));
        }
        steps.push(
          makeStep(
            'search contacts',
            'sendgrid_search_contacts',
            contactId ? 'pass' : 'fail',
            contactId
              ? `found after ${Math.round((Date.now() - started) / 1000)}s`
              : (lastError ?? `contact not indexed within ${CONTACT_SEARCH_TIMEOUT_MS / 1000}s`),
          ),
        );
      }

      if (list) {
        const segment = await step<{ id: string }>('create segment', 'sendgrid_create_segment', {
          name: runId,
          query_dsl: `SELECT contact_id, updated_at FROM contact_data WHERE email = '${email}'`,
          parent_list_ids: [list.id],
        });
        if (segment) {
          try {
            await step('get segment', 'sendgrid_get_segment', { segment_id: segment.id });
            await step('update segment', 'sendgrid_update_segment', {
              segment_id: segment.id,
              name: `${runId}-updated`,
            });
          } finally {
            await cleanup(
              'delete segment',
              'sendgrid_delete_segment',
              { segment_id: segment.id },
              `segment ${segment.id}`,
            );
          }
        }
        if (contactId) {
          await step('remove contact from list', 'sendgrid_remove_contacts_from_list', {
            list_id: list.id,
            contact_ids: [contactId],
          });
        } else {
          steps.push(
            await probeTool(call, tools, 'remove contact from list (probe)', 'sendgrid_remove_contacts_from_list', {
              list_id: list.id,
              contact_ids: [SYNTHETIC_ID],
            }),
          );
        }
      }
    } finally {
      if (contactId) {
        await cleanup('delete contact', 'sendgrid_delete_contacts', { ids: [contactId] }, `contact ${email}`);
      } else if (contactWritten) {
        log.error(`sendgrid smoke leaked contact ${email}: never indexed, so it has no id to delete`);
        steps.push(makeStep('delete contact', 'sendgrid_delete_contacts', 'fail', `leaked contact ${email}`));
      }
      if (list) await cleanup('delete list', 'sendgrid_delete_list', { list_id: list.id }, `list ${list.id}`);
    }

    return steps;
  },
};
