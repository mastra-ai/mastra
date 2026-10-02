import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep Resend scenario: audience + contact + segment + contact-property +
 * contact-import + topic + template + webhook + broadcast + domain CRUD plus
 * the broad read-only surface.
 *
 * The scenario never actually sends mail. send_email / send_email_batch /
 * send_broadcast go through probeTool so routing is exercised but no real
 * message is dispatched to an inbox.
 *
 * NOTE: Current Resend tools use a nested `{ body: {...} }` wrapper on
 * mutators and snake_case fields. ID parameters vary — see each call site.
 */
export const resendScenario: Scenario = {
  integrationId: 'resend',
  summary: 'audience + contact + segment + property + topic + template + webhook + broadcast + domain CRUD',
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

    // ---- read-only surface ----
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
          ['resend_list_segments', { limit: 5 }],
          ['resend_list_contacts', { limit: 5 }],
          ['resend_list_contact_imports', { limit: 5 }],
          ['resend_list_contact_properties', { limit: 5 }],
          ['resend_list_emails', { limit: 5 }],
          ['resend_list_received_emails', { limit: 5 }],
        ],
        tools,
      )),
    );

    if (tools['resend_get_email_metrics']) {
      try {
        await call('resend_get_email_metrics', {});
        steps.push(makeStep('read email metrics', 'resend_get_email_metrics', 'pass'));
      } catch (error) {
        steps.push(makeStep('read email metrics', 'resend_get_email_metrics', 'fail', errorMessage(error)));
      }
    }

    // ---- audience ----
    let audienceId: string | undefined;
    try {
      const audience = await call<{ id: string }>('resend_create_audience', {
        body: { name: `${runId} smoke audience` },
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

    // ---- contact (nested body) ----
    let contactId: string | undefined;
    try {
      const contact = await call<{ id: string }>('resend_create_contact', {
        audience_id: audienceId,
        body: {
          email: `smoke+${runId}@mastra-smoke.invalid`,
          first_name: 'Mastra',
          last_name: 'Smoke',
        },
      });
      contactId = contact.id;
      steps.push(makeStep('create contact', 'resend_create_contact', 'pass', contactId));
    } catch (error) {
      steps.push(makeStep('create contact', 'resend_create_contact', 'fail', errorMessage(error)));
    }
    if (contactId && tools['resend_get_contact']) {
      try {
        await call('resend_get_contact', { id: contactId });
        steps.push(makeStep('read contact', 'resend_get_contact', 'pass'));
      } catch (error) {
        steps.push(makeStep('read contact', 'resend_get_contact', 'fail', errorMessage(error)));
      }
    }
    if (contactId && tools['resend_update_contact']) {
      try {
        await call('resend_update_contact', {
          id: contactId,
          body: { first_name: 'Mastra-edited' },
        });
        steps.push(makeStep('update contact', 'resend_update_contact', 'pass'));
      } catch (error) {
        steps.push(makeStep('update contact', 'resend_update_contact', 'fail', errorMessage(error)));
      }
    }
    if (contactId && tools['resend_list_contact_segments']) {
      try {
        await call('resend_list_contact_segments', { contact_id: contactId, limit: 5 });
        steps.push(makeStep('list contact segments', 'resend_list_contact_segments', 'pass'));
      } catch (error) {
        steps.push(makeStep('list contact segments', 'resend_list_contact_segments', 'fail', errorMessage(error)));
      }
    }
    if (contactId && tools['resend_list_contact_topics']) {
      try {
        await call('resend_list_contact_topics', { contact_id: contactId, limit: 5 });
        steps.push(makeStep('list contact topics', 'resend_list_contact_topics', 'pass'));
      } catch (error) {
        steps.push(makeStep('list contact topics', 'resend_list_contact_topics', 'fail', errorMessage(error)));
      }
    }

    // ---- contact property ----
    const propertyKey = `smoke_${runId.replace(/[^a-z0-9_]/gi, '_')}`;
    let contactPropertyId: string | undefined;
    if (tools['resend_create_contact_property']) {
      try {
        const property = await call<{ id: string }>('resend_create_contact_property', {
          body: { key: propertyKey, type: 'string', fallback_value: 'smoke' },
        });
        contactPropertyId = property.id;
        steps.push(makeStep('create contact property', 'resend_create_contact_property', 'pass', contactPropertyId));
      } catch (error) {
        steps.push(makeStep('create contact property', 'resend_create_contact_property', 'fail', errorMessage(error)));
      }
    }
    if (contactPropertyId && tools['resend_get_contact_property']) {
      try {
        await call('resend_get_contact_property', { id: contactPropertyId });
        steps.push(makeStep('read contact property', 'resend_get_contact_property', 'pass'));
      } catch (error) {
        steps.push(makeStep('read contact property', 'resend_get_contact_property', 'fail', errorMessage(error)));
      }
    }
    if (contactPropertyId && tools['resend_update_contact_property']) {
      try {
        await call('resend_update_contact_property', {
          id: contactPropertyId,
          body: { fallback_value: 'smoke-updated' },
        });
        steps.push(makeStep('update contact property', 'resend_update_contact_property', 'pass'));
      } catch (error) {
        steps.push(makeStep('update contact property', 'resend_update_contact_property', 'fail', errorMessage(error)));
      }
    }
    if (contactPropertyId && tools['resend_delete_contact_property']) {
      try {
        await call('resend_delete_contact_property', { id: contactPropertyId });
        steps.push(makeStep('delete contact property', 'resend_delete_contact_property', 'pass'));
      } catch (error) {
        log.warn(`Failed to delete smoke contact property ${contactPropertyId}`, errorMessage(error));
        steps.push(makeStep('delete contact property', 'resend_delete_contact_property', 'fail', errorMessage(error)));
      }
    }

    // ---- contact import (small inline CSV) ----
    let importId: string | undefined;
    if (tools['resend_create_contact_import']) {
      try {
        const importResult = await call<{ id: string }>('resend_create_contact_import', {
          body: {
            file: `email,first_name\nimport+${runId}@mastra-smoke.invalid,Imported`,
            filename: `smoke-${runId}.csv`,
            audience_id: audienceId,
          },
        });
        importId = importResult.id;
        steps.push(makeStep('create contact import', 'resend_create_contact_import', 'pass', importId));
      } catch (error) {
        steps.push(makeStep('create contact import', 'resend_create_contact_import', 'fail', errorMessage(error)));
      }
    }
    if (importId && tools['resend_get_contact_import']) {
      try {
        await call('resend_get_contact_import', { id: importId });
        steps.push(makeStep('read contact import', 'resend_get_contact_import', 'pass'));
      } catch (error) {
        steps.push(makeStep('read contact import', 'resend_get_contact_import', 'fail', errorMessage(error)));
      }
    }

    // ---- segment ----
    let segmentId: string | undefined;
    if (tools['resend_create_segment']) {
      try {
        const segment = await call<{ id: string }>('resend_create_segment', {
          body: { name: `${runId} smoke segment`, audience_id: audienceId },
        });
        segmentId = segment.id;
        steps.push(makeStep('create segment', 'resend_create_segment', 'pass', segmentId));
      } catch (error) {
        steps.push(makeStep('create segment', 'resend_create_segment', 'fail', errorMessage(error)));
      }
    }
    if (segmentId && tools['resend_get_segment']) {
      try {
        await call('resend_get_segment', { id: segmentId });
        steps.push(makeStep('read segment', 'resend_get_segment', 'pass'));
      } catch (error) {
        steps.push(makeStep('read segment', 'resend_get_segment', 'fail', errorMessage(error)));
      }
    }
    if (segmentId && tools['resend_update_segment']) {
      try {
        await call('resend_update_segment', {
          id: segmentId,
          body: { name: `${runId} smoke segment (updated)` },
        });
        steps.push(makeStep('update segment', 'resend_update_segment', 'pass'));
      } catch (error) {
        steps.push(makeStep('update segment', 'resend_update_segment', 'fail', errorMessage(error)));
      }
    }
    if (segmentId && contactId && tools['resend_add_contact_to_segment']) {
      try {
        await call('resend_add_contact_to_segment', { contact_id: contactId, segment_id: segmentId });
        steps.push(makeStep('add contact to segment', 'resend_add_contact_to_segment', 'pass'));
      } catch (error) {
        steps.push(makeStep('add contact to segment', 'resend_add_contact_to_segment', 'fail', errorMessage(error)));
      }
    }
    if (segmentId && contactId && tools['resend_remove_contact_from_segment']) {
      try {
        await call('resend_remove_contact_from_segment', { contact_id: contactId, segment_id: segmentId });
        steps.push(makeStep('remove contact from segment', 'resend_remove_contact_from_segment', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('remove contact from segment', 'resend_remove_contact_from_segment', 'fail', errorMessage(error)),
        );
      }
    }

    // ---- topic ----
    let topicId: string | undefined;
    if (tools['resend_create_topic']) {
      try {
        const topic = await call<{ id: string }>('resend_create_topic', {
          body: {
            name: `${runId.slice(0, 40)} smoke topic`,
            default_subscription: 'opt_in',
            description: 'Mastra smoke topic.',
          },
        });
        topicId = topic.id;
        steps.push(makeStep('create topic', 'resend_create_topic', 'pass', topicId));
      } catch (error) {
        steps.push(makeStep('create topic', 'resend_create_topic', 'fail', errorMessage(error)));
      }
    }
    if (topicId && tools['resend_get_topic']) {
      try {
        await call('resend_get_topic', { id: topicId });
        steps.push(makeStep('read topic', 'resend_get_topic', 'pass'));
      } catch (error) {
        steps.push(makeStep('read topic', 'resend_get_topic', 'fail', errorMessage(error)));
      }
    }
    if (topicId && tools['resend_update_topic']) {
      try {
        await call('resend_update_topic', {
          id: topicId,
          body: { description: 'Mastra smoke topic (updated).' },
        });
        steps.push(makeStep('update topic', 'resend_update_topic', 'pass'));
      } catch (error) {
        steps.push(makeStep('update topic', 'resend_update_topic', 'fail', errorMessage(error)));
      }
    }
    if (topicId && contactId && tools['resend_update_contact_topics']) {
      try {
        await call('resend_update_contact_topics', {
          contact_id: contactId,
          body: { topics: [{ id: topicId, subscription: 'opt_out' }] },
        });
        steps.push(makeStep('update contact topics', 'resend_update_contact_topics', 'pass'));
      } catch (error) {
        steps.push(makeStep('update contact topics', 'resend_update_contact_topics', 'fail', errorMessage(error)));
      }
    } else if (tools['resend_update_contact_topics']) {
      steps.push(
        await probeTool(call, tools, 'update contact topics', 'resend_update_contact_topics', {
          contact_id: contactId ?? `contact-smoke-${runId}`,
          body: { topics: [{ id: topicId ?? `topic-smoke-${runId}`, subscription: 'opt_out' }] },
        }),
      );
    }
    if (topicId && tools['resend_delete_topic']) {
      try {
        await call('resend_delete_topic', { id: topicId });
        steps.push(makeStep('delete topic', 'resend_delete_topic', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke topic ${topicId}`, errorMessage(error));
        steps.push(makeStep('delete topic', 'resend_delete_topic', 'fail', errorMessage(error)));
      }
    }

    // ---- template ----
    let templateId: string | undefined;
    if (tools['resend_create_template']) {
      try {
        const template = await call<{ id: string }>('resend_create_template', {
          body: {
            name: `${runId} smoke template`,
            html: `<p>Hello ${runId}</p>`,
            subject: 'smoke test',
          },
        });
        templateId = template.id;
        steps.push(makeStep('create template', 'resend_create_template', 'pass', templateId));
      } catch (error) {
        steps.push(makeStep('create template', 'resend_create_template', 'fail', errorMessage(error)));
      }
    }
    if (templateId && tools['resend_get_template']) {
      try {
        await call('resend_get_template', { id: templateId });
        steps.push(makeStep('read template', 'resend_get_template', 'pass'));
      } catch (error) {
        steps.push(makeStep('read template', 'resend_get_template', 'fail', errorMessage(error)));
      }
    }
    if (templateId && tools['resend_update_template']) {
      try {
        await call('resend_update_template', {
          id: templateId,
          body: { name: `${runId} smoke template (updated)` },
        });
        steps.push(makeStep('update template', 'resend_update_template', 'pass'));
      } catch (error) {
        steps.push(makeStep('update template', 'resend_update_template', 'fail', errorMessage(error)));
      }
    }
    let duplicateTemplateId: string | undefined;
    if (templateId && tools['resend_duplicate_template']) {
      try {
        const dup = await call<{ id: string }>('resend_duplicate_template', { id: templateId });
        duplicateTemplateId = dup.id;
        steps.push(makeStep('duplicate template', 'resend_duplicate_template', 'pass', duplicateTemplateId));
      } catch (error) {
        steps.push(makeStep('duplicate template', 'resend_duplicate_template', 'fail', errorMessage(error)));
      }
    }
    if (templateId && tools['resend_publish_template']) {
      try {
        await call('resend_publish_template', { id: templateId });
        steps.push(makeStep('publish template', 'resend_publish_template', 'pass'));
      } catch (error) {
        steps.push(makeStep('publish template', 'resend_publish_template', 'fail', errorMessage(error)));
      }
    }
    if (duplicateTemplateId && tools['resend_delete_template']) {
      try {
        await call('resend_delete_template', { id: duplicateTemplateId });
      } catch (error) {
        log.warn(`Could not delete duplicate template ${duplicateTemplateId}`, errorMessage(error));
      }
    }

    // ---- webhook ----
    let webhookId: string | undefined;
    if (tools['resend_create_webhook']) {
      try {
        const webhook = await call<{ id: string }>('resend_create_webhook', {
          body: {
            endpoint: `https://smoke.mastra.invalid/webhook/${runId}`,
            events: ['email.sent'],
          },
        });
        webhookId = webhook.id;
        steps.push(makeStep('create webhook', 'resend_create_webhook', 'pass', webhookId));
      } catch (error) {
        steps.push(makeStep('create webhook', 'resend_create_webhook', 'fail', errorMessage(error)));
      }
    }
    if (webhookId && tools['resend_get_webhook']) {
      try {
        await call('resend_get_webhook', { webhook_id: webhookId });
        steps.push(makeStep('read webhook', 'resend_get_webhook', 'pass'));
      } catch (error) {
        steps.push(makeStep('read webhook', 'resend_get_webhook', 'fail', errorMessage(error)));
      }
    }
    if (webhookId && tools['resend_update_webhook']) {
      try {
        await call('resend_update_webhook', {
          webhook_id: webhookId,
          body: { status: 'disabled' },
        });
        steps.push(makeStep('update webhook', 'resend_update_webhook', 'pass'));
      } catch (error) {
        steps.push(makeStep('update webhook', 'resend_update_webhook', 'fail', errorMessage(error)));
      }
    }
    if (webhookId && tools['resend_list_webhook_events']) {
      try {
        await call('resend_list_webhook_events', { webhook_id: webhookId, limit: 5 });
        steps.push(makeStep('list webhook events', 'resend_list_webhook_events', 'pass'));
      } catch (error) {
        steps.push(makeStep('list webhook events', 'resend_list_webhook_events', 'fail', errorMessage(error)));
      }
    }
    // get_webhook_event / list_webhook_event_attempts / replay_webhook_event all
    // need a real delivered event id — probe them.
    if (tools['resend_get_webhook_event']) {
      steps.push(
        await probeTool(call, tools, 'read webhook event', 'resend_get_webhook_event', {
          webhook_id: webhookId ?? `webhook-smoke-${runId}`,
          event_id: `event-smoke-${runId}`,
        }),
      );
    }
    if (tools['resend_list_webhook_event_attempts']) {
      steps.push(
        await probeTool(call, tools, 'list webhook event attempts', 'resend_list_webhook_event_attempts', {
          webhook_id: webhookId ?? `webhook-smoke-${runId}`,
          event_id: `event-smoke-${runId}`,
          limit: 5,
        }),
      );
    }
    if (tools['resend_replay_webhook_event']) {
      steps.push(
        await probeTool(call, tools, 'replay webhook event', 'resend_replay_webhook_event', {
          webhook_id: webhookId ?? `webhook-smoke-${runId}`,
          event_id: `event-smoke-${runId}`,
        }),
      );
    }
    if (webhookId && tools['resend_delete_webhook']) {
      try {
        await call('resend_delete_webhook', { webhook_id: webhookId });
        steps.push(makeStep('delete webhook', 'resend_delete_webhook', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke webhook ${webhookId}`, errorMessage(error));
        steps.push(makeStep('delete webhook', 'resend_delete_webhook', 'fail', errorMessage(error)));
      }
    }

    // ---- domain + domain claim (DNS verification won't succeed; probe-friendly) ----
    let domainId: string | undefined;
    const domainName = `smoke-${runId.replace(/[^a-z0-9-]/gi, '').toLowerCase()}.mastra-smoke.invalid`;
    if (tools['resend_create_domain']) {
      try {
        const domain = await call<{ id: string }>('resend_create_domain', {
          body: { name: domainName },
        });
        domainId = domain.id;
        steps.push(makeStep('create domain', 'resend_create_domain', 'pass', domainId));
      } catch (error) {
        steps.push(makeStep('create domain', 'resend_create_domain', 'fail', errorMessage(error)));
      }
    }
    if (domainId && tools['resend_get_domain']) {
      try {
        await call('resend_get_domain', { domain_id: domainId });
        steps.push(makeStep('read domain', 'resend_get_domain', 'pass'));
      } catch (error) {
        steps.push(makeStep('read domain', 'resend_get_domain', 'fail', errorMessage(error)));
      }
    }
    if (domainId && tools['resend_update_domain']) {
      try {
        await call('resend_update_domain', {
          domain_id: domainId,
          body: { open_tracking: true },
        });
        steps.push(makeStep('update domain', 'resend_update_domain', 'pass'));
      } catch (error) {
        steps.push(makeStep('update domain', 'resend_update_domain', 'fail', errorMessage(error)));
      }
    }
    if (domainId && tools['resend_verify_domain']) {
      // DNS verification will fail on .invalid TLD — probe-style for a safe pass.
      steps.push(await probeTool(call, tools, 'verify domain', 'resend_verify_domain', { domain_id: domainId }));
    }
    let domainClaimId: string | undefined;
    if (tools['resend_create_domain_claim']) {
      try {
        const claim = await call<{ id: string }>('resend_create_domain_claim', {
          body: { name: `claim-${domainName}` },
        });
        domainClaimId = claim.id;
        steps.push(makeStep('create domain claim', 'resend_create_domain_claim', 'pass', domainClaimId));
      } catch (error) {
        steps.push(makeStep('create domain claim', 'resend_create_domain_claim', 'fail', errorMessage(error)));
      }
    }
    if (domainClaimId && tools['resend_get_domain_claim']) {
      try {
        await call('resend_get_domain_claim', { domain_id: domainClaimId });
        steps.push(makeStep('read domain claim', 'resend_get_domain_claim', 'pass'));
      } catch (error) {
        steps.push(makeStep('read domain claim', 'resend_get_domain_claim', 'fail', errorMessage(error)));
      }
    } else if (tools['resend_get_domain_claim']) {
      steps.push(
        await probeTool(call, tools, 'read domain claim', 'resend_get_domain_claim', {
          domain_id: `claim-smoke-${runId}`,
        }),
      );
    }
    if (domainClaimId && tools['resend_verify_domain_claim']) {
      steps.push(
        await probeTool(call, tools, 'verify domain claim', 'resend_verify_domain_claim', {
          domain_id: domainClaimId,
        }),
      );
    } else if (tools['resend_verify_domain_claim']) {
      steps.push(
        await probeTool(call, tools, 'verify domain claim', 'resend_verify_domain_claim', {
          domain_id: `claim-smoke-${runId}`,
        }),
      );
    }
    if (domainId && tools['resend_delete_domain']) {
      try {
        await call('resend_delete_domain', { domain_id: domainId });
        steps.push(makeStep('delete domain', 'resend_delete_domain', 'pass'));
      } catch (error) {
        log.warn(`Failed to delete smoke domain ${domainId}`, errorMessage(error));
        steps.push(makeStep('delete domain', 'resend_delete_domain', 'fail', errorMessage(error)));
      }
    }

    // ---- broadcast (requires segment; delete-only lifecycle to avoid send) ----
    let broadcastId: string | undefined;
    if (segmentId && tools['resend_create_broadcast']) {
      try {
        const broadcast = await call<{ id: string }>('resend_create_broadcast', {
          body: {
            name: `${runId} smoke broadcast`,
            segment_id: segmentId,
            audience_id: audienceId,
            from: `smoke+${runId}@mastra-smoke.invalid`,
            subject: 'smoke broadcast — do not send',
            html: `<p>Mastra smoke broadcast ${runId}</p>`,
            send: false,
          },
        });
        broadcastId = broadcast.id;
        steps.push(makeStep('create broadcast', 'resend_create_broadcast', 'pass', broadcastId));
      } catch (error) {
        steps.push(makeStep('create broadcast', 'resend_create_broadcast', 'fail', errorMessage(error)));
      }
    } else if (tools['resend_create_broadcast']) {
      steps.push(
        await probeTool(call, tools, 'create broadcast', 'resend_create_broadcast', {
          body: {
            segment_id: `segment-smoke-${runId}`,
            from: `smoke+${runId}@mastra-smoke.invalid`,
            subject: 'smoke',
            html: '<p>smoke</p>',
          },
        }),
      );
    }
    if (broadcastId && tools['resend_get_broadcast']) {
      try {
        await call('resend_get_broadcast', { id: broadcastId });
        steps.push(makeStep('read broadcast', 'resend_get_broadcast', 'pass'));
      } catch (error) {
        steps.push(makeStep('read broadcast', 'resend_get_broadcast', 'fail', errorMessage(error)));
      }
    }
    if (broadcastId && tools['resend_update_broadcast']) {
      try {
        await call('resend_update_broadcast', {
          id: broadcastId,
          body: { subject: 'smoke broadcast (updated) — do not send' },
        });
        steps.push(makeStep('update broadcast', 'resend_update_broadcast', 'pass'));
      } catch (error) {
        steps.push(makeStep('update broadcast', 'resend_update_broadcast', 'fail', errorMessage(error)));
      }
    }
    if (tools['resend_list_broadcast_recipients']) {
      steps.push(
        await probeTool(call, tools, 'list broadcast recipients', 'resend_list_broadcast_recipients', {
          id: broadcastId ?? `broadcast-smoke-${runId}`,
          type: 'sent',
          limit: 5,
        }),
      );
    }
    if (tools['resend_list_broadcast_clicked_links']) {
      steps.push(
        await probeTool(call, tools, 'list broadcast clicked links', 'resend_list_broadcast_clicked_links', {
          id: broadcastId ?? `broadcast-smoke-${runId}`,
          limit: 5,
        }),
      );
    }
    if (tools['resend_send_broadcast']) {
      // probe only — send_broadcast dispatches real email
      steps.push(
        await probeTool(call, tools, 'send broadcast', 'resend_send_broadcast', {
          id: `broadcast-smoke-${runId}`,
          body: {},
        }),
      );
    }
    if (tools['resend_cancel_broadcast']) {
      steps.push(
        await probeTool(call, tools, 'cancel broadcast', 'resend_cancel_broadcast', {
          id: `broadcast-smoke-${runId}`,
        }),
      );
    }
    if (broadcastId && tools['resend_delete_broadcast']) {
      try {
        await call('resend_delete_broadcast', { id: broadcastId });
        steps.push(makeStep('delete broadcast', 'resend_delete_broadcast', 'pass'));
      } catch (error) {
        log.warn(`Failed to delete smoke broadcast ${broadcastId}`, errorMessage(error));
        steps.push(makeStep('delete broadcast', 'resend_delete_broadcast', 'fail', errorMessage(error)));
      }
    } else if (tools['resend_delete_broadcast']) {
      steps.push(
        await probeTool(call, tools, 'delete broadcast', 'resend_delete_broadcast', {
          id: `broadcast-smoke-${runId}`,
        }),
      );
    }

    // ---- email sending (always probe-only to avoid mailing real recipients) ----
    if (tools['resend_send_email']) {
      steps.push(
        await probeTool(call, tools, 'send email', 'resend_send_email', {
          body: {
            from: `smoke+${runId}@mastra-smoke.invalid`,
            to: `nobody+${runId}@mastra-smoke.invalid`,
            subject: 'smoke email — do not deliver',
            html: '<p>smoke</p>',
          },
        }),
      );
    }
    if (tools['resend_send_email_batch']) {
      steps.push(
        await probeTool(call, tools, 'send email batch', 'resend_send_email_batch', {
          body: [
            {
              from: `smoke+${runId}@mastra-smoke.invalid`,
              to: `nobody+${runId}@mastra-smoke.invalid`,
              subject: 'smoke batch — do not deliver',
              html: '<p>smoke batch</p>',
            },
          ],
        }),
      );
    }
    if (tools['resend_get_email']) {
      steps.push(
        await probeTool(call, tools, 'read email', 'resend_get_email', {
          email_id: `email-smoke-${runId}`,
        }),
      );
    }
    if (tools['resend_update_email']) {
      steps.push(
        await probeTool(call, tools, 'update email', 'resend_update_email', {
          email_id: `email-smoke-${runId}`,
          body: { scheduled_at: new Date(Date.now() + 60_000).toISOString() },
        }),
      );
    }
    if (tools['resend_cancel_email']) {
      steps.push(
        await probeTool(call, tools, 'cancel email', 'resend_cancel_email', {
          email_id: `email-smoke-${runId}`,
        }),
      );
    }
    if (tools['resend_share_email']) {
      steps.push(
        await probeTool(call, tools, 'share email', 'resend_share_email', {
          email_id: `email-smoke-${runId}`,
          body: { expires_in: '1h' },
        }),
      );
    }
    if (tools['resend_list_email_attachments']) {
      steps.push(
        await probeTool(call, tools, 'list email attachments', 'resend_list_email_attachments', {
          email_id: `email-smoke-${runId}`,
          limit: 5,
        }),
      );
    }
    if (tools['resend_get_email_attachment']) {
      steps.push(
        await probeTool(call, tools, 'read email attachment', 'resend_get_email_attachment', {
          email_id: `email-smoke-${runId}`,
          attachment_id: `attach-smoke-${runId}`,
        }),
      );
    }
    if (tools['resend_get_received_email']) {
      steps.push(
        await probeTool(call, tools, 'read received email', 'resend_get_received_email', {
          email_id: `rec-smoke-${runId}`,
        }),
      );
    }
    if (tools['resend_list_received_email_attachments']) {
      steps.push(
        await probeTool(call, tools, 'list received email attachments', 'resend_list_received_email_attachments', {
          email_id: `rec-smoke-${runId}`,
          limit: 5,
        }),
      );
    }
    if (tools['resend_get_received_email_attachment']) {
      steps.push(
        await probeTool(call, tools, 'read received email attachment', 'resend_get_received_email_attachment', {
          email_id: `rec-smoke-${runId}`,
          attachment_id: `rec-attach-smoke-${runId}`,
        }),
      );
    }

    // ---- cleanup ----
    if (segmentId && tools['resend_delete_segment']) {
      try {
        await call('resend_delete_segment', { id: segmentId });
        steps.push(makeStep('delete segment', 'resend_delete_segment', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke segment ${segmentId}`, errorMessage(error));
        steps.push(makeStep('delete segment', 'resend_delete_segment', 'fail', errorMessage(error)));
      }
    }
    if (templateId && tools['resend_delete_template']) {
      try {
        await call('resend_delete_template', { id: templateId });
        steps.push(makeStep('delete template', 'resend_delete_template', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke template ${templateId}`, errorMessage(error));
        steps.push(makeStep('delete template', 'resend_delete_template', 'fail', errorMessage(error)));
      }
    }
    if (contactId) {
      try {
        await call('resend_delete_contact', { id: contactId });
        steps.push(makeStep('delete contact', 'resend_delete_contact', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke contact ${contactId}`, errorMessage(error));
        steps.push(makeStep('delete contact', 'resend_delete_contact', 'fail', errorMessage(error)));
      }
    }
    try {
      await call('resend_delete_audience', { id: audienceId });
      steps.push(makeStep('delete audience', 'resend_delete_audience', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke audience ${audienceId}`, errorMessage(error));
      steps.push(makeStep('delete audience', 'resend_delete_audience', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
