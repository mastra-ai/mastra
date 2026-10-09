import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep HubSpot scenario: contact + company + deal + ticket + task lifecycle
 * plus association creation and ownership reads.
 */
export const hubspotScenario: Scenario = {
  integrationId: 'hubspot',
  summary: 'contact + company + deal + ticket + task CRUD',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'hubspot_create_contact',
      'hubspot_get_contact',
      'hubspot_update_contact',
      'hubspot_delete_contact',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['hubspot_whoami', {}],
          ['hubspot_fetch_account_information', {}],
          ['hubspot_fetch_pipelines', { objectType: 'deals' }],
          ['hubspot_fetch_properties', { objectType: 'contacts' }],
          ['hubspot_list_contacts', {}],
          ['hubspot_list_companies', {}],
          ['hubspot_list_deals', {}],
          ['hubspot_list_tickets', { limit: 5 }],
          ['hubspot_list_forms', {}],
        ],
        tools,
      )),
    );

    // HubSpot's contact email validator rejects reserved TLDs like `.invalid`
    // and `.test`, so we use the IETF-reserved `example.com` domain — valid
    // format, guaranteed never to receive mail. `company.domain` below stays
    // on `.invalid` because HubSpot only validates email addresses, not domains.
    const emailDomain = `${runId}.mastra-smoke.invalid`;
    const contactEmail = `smoke-${runId}@example.com`;
    let contactId: string | undefined;
    try {
      const contact = await call<{ id: string }>('hubspot_create_contact', {
        email: contactEmail,
        firstname: 'Mastra',
        lastname: `Smoke-${runId}`,
      });
      contactId = contact.id;
      steps.push(makeStep('create contact', 'hubspot_create_contact', 'pass', contactId));
    } catch (error) {
      steps.push(makeStep('create contact', 'hubspot_create_contact', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      await call('hubspot_get_contact', { contactId });
      steps.push(makeStep('read contact', 'hubspot_get_contact', 'pass'));
    } catch (error) {
      steps.push(makeStep('read contact', 'hubspot_get_contact', 'fail', errorMessage(error)));
    }

    try {
      await call('hubspot_update_contact', {
        contactId,
        company: 'mastra-smoke',
      });
      steps.push(makeStep('update contact', 'hubspot_update_contact', 'pass'));
    } catch (error) {
      steps.push(makeStep('update contact', 'hubspot_update_contact', 'fail', errorMessage(error)));
    }

    let companyId: string | undefined;
    if (tools['hubspot_create_company']) {
      try {
        const company = await call<{ id: string }>('hubspot_create_company', {
          name: `${runId} smoke company`,
          domain: emailDomain,
        });
        companyId = company.id;
        steps.push(makeStep('create company', 'hubspot_create_company', 'pass', companyId));
      } catch (error) {
        steps.push(makeStep('create company', 'hubspot_create_company', 'fail', errorMessage(error)));
      }
    }

    if (companyId && tools['hubspot_create_association']) {
      try {
        await call('hubspot_create_association', {
          fromObjectType: 'contacts',
          fromObjectId: contactId,
          toObjectType: 'companies',
          toObjectId: companyId,
          associationType: 'contact_to_company',
        });
        steps.push(makeStep('create association', 'hubspot_create_association', 'pass'));
      } catch (error) {
        steps.push(makeStep('create association', 'hubspot_create_association', 'fail', errorMessage(error)));
      }
    }

    let dealId: string | undefined;
    if (tools['hubspot_create_deal']) {
      try {
        const deal = await call<{ id: string }>('hubspot_create_deal', {
          dealName: `${runId} smoke deal`,
          amount: 1,
        });
        dealId = deal.id;
        steps.push(makeStep('create deal', 'hubspot_create_deal', 'pass', dealId));
      } catch (error) {
        steps.push(makeStep('create deal', 'hubspot_create_deal', 'fail', errorMessage(error)));
      }
    }

    // HubSpot ticket creation requires a pipeline + stage pair; portals ship a
    // default "Support Pipeline" we can discover via fetch_pipelines. We pass
    // the stage id of the first stage of the first ticket pipeline so the
    // ticket lands in a valid state regardless of portal customisation.
    let ticketPipeline: string | undefined;
    let ticketStage: string | undefined;
    if (tools['hubspot_fetch_pipelines']) {
      try {
        const pipelines = await call<{ pipelines: Array<{ id: string; stages: Array<{ id: string }> }> }>(
          'hubspot_fetch_pipelines',
          { objectType: 'tickets' },
        );
        const first = pipelines.pipelines?.[0];
        ticketPipeline = first?.id;
        ticketStage = first?.stages?.[0]?.id;
      } catch (error) {
        log.error('Failed to resolve ticket pipeline for smoke run', errorMessage(error));
      }
    }

    let ticketId: string | undefined;
    if (tools['hubspot_create_ticket']) {
      try {
        const ticket = await call<{ id: string }>('hubspot_create_ticket', {
          subject: `${runId} smoke ticket`,
          ...(ticketPipeline ? { hs_pipeline: ticketPipeline } : {}),
          ...(ticketStage ? { hs_pipeline_stage: ticketStage } : {}),
        });
        ticketId = ticket.id;
        steps.push(makeStep('create ticket', 'hubspot_create_ticket', 'pass', ticketId));
      } catch (error) {
        steps.push(makeStep('create ticket', 'hubspot_create_ticket', 'fail', errorMessage(error)));
      }
    }

    let taskId: string | undefined;
    if (tools['hubspot_create_task']) {
      try {
        // dueDate is required by the create-task schema. One hour from "now"
        // keeps the task self-contained (we delete it later in cleanup) and
        // avoids HubSpot flagging it as overdue mid-run.
        const dueDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const task = await call<{ id: string }>('hubspot_create_task', {
          subject: `${runId} smoke task`,
          type: 'TODO',
          dueDate,
        });
        taskId = task.id;
        steps.push(makeStep('create task', 'hubspot_create_task', 'pass', taskId));
      } catch (error) {
        steps.push(makeStep('create task', 'hubspot_create_task', 'fail', errorMessage(error)));
      }
    }

    // Getters on created primary objects (get_company, get_deal, get_ticket).
    if (companyId && tools['hubspot_get_company']) {
      try {
        await call('hubspot_get_company', { id: companyId });
        steps.push(makeStep('get company', 'hubspot_get_company', 'pass'));
      } catch (error) {
        steps.push(makeStep('get company', 'hubspot_get_company', 'fail', errorMessage(error)));
      }
    }
    if (dealId && tools['hubspot_get_deal']) {
      try {
        await call('hubspot_get_deal', { dealId });
        steps.push(makeStep('get deal', 'hubspot_get_deal', 'pass'));
      } catch (error) {
        steps.push(makeStep('get deal', 'hubspot_get_deal', 'fail', errorMessage(error)));
      }
    }
    if (ticketId && tools['hubspot_get_ticket']) {
      try {
        await call('hubspot_get_ticket', { ticketId });
        steps.push(makeStep('get ticket', 'hubspot_get_ticket', 'pass'));
      } catch (error) {
        steps.push(makeStep('get ticket', 'hubspot_get_ticket', 'fail', errorMessage(error)));
      }
    }

    // Updates on created primary objects.
    if (companyId && tools['hubspot_update_company']) {
      try {
        await call('hubspot_update_company', { id: companyId, name: `${runId} smoke company (edit)` });
        steps.push(makeStep('update company', 'hubspot_update_company', 'pass'));
      } catch (error) {
        steps.push(makeStep('update company', 'hubspot_update_company', 'fail', errorMessage(error)));
      }
    }
    if (dealId && tools['hubspot_update_deal']) {
      try {
        await call('hubspot_update_deal', { dealId, dealname: `${runId} smoke deal (edit)` });
        steps.push(makeStep('update deal', 'hubspot_update_deal', 'pass'));
      } catch (error) {
        steps.push(makeStep('update deal', 'hubspot_update_deal', 'fail', errorMessage(error)));
      }
    }
    if (ticketId && tools['hubspot_update_ticket']) {
      try {
        await call('hubspot_update_ticket', { ticketId, subject: `${runId} smoke ticket (edit)` });
        steps.push(makeStep('update ticket', 'hubspot_update_ticket', 'pass'));
      } catch (error) {
        steps.push(makeStep('update ticket', 'hubspot_update_ticket', 'fail', errorMessage(error)));
      }
    }
    if (taskId && tools['hubspot_update_task']) {
      try {
        await call('hubspot_update_task', { taskId, subject: `${runId} smoke task (edit)` });
        steps.push(makeStep('update task', 'hubspot_update_task', 'pass'));
      } catch (error) {
        steps.push(makeStep('update task', 'hubspot_update_task', 'fail', errorMessage(error)));
      }
    }

    // Search surfaces (name/subject filters hit our runId-tagged records).
    if (tools['hubspot_search_contacts']) {
      try {
        await call('hubspot_search_contacts', { email: contactEmail });
        steps.push(makeStep('search contacts', 'hubspot_search_contacts', 'pass'));
      } catch (error) {
        steps.push(makeStep('search contacts', 'hubspot_search_contacts', 'fail', errorMessage(error)));
      }
    }
    if (tools['hubspot_search_companies']) {
      try {
        await call('hubspot_search_companies', { name: runId });
        steps.push(makeStep('search companies', 'hubspot_search_companies', 'pass'));
      } catch (error) {
        steps.push(makeStep('search companies', 'hubspot_search_companies', 'fail', errorMessage(error)));
      }
    }
    if (tools['hubspot_search_deals']) {
      try {
        await call('hubspot_search_deals', { dealName: runId });
        steps.push(makeStep('search deals', 'hubspot_search_deals', 'pass'));
      } catch (error) {
        steps.push(makeStep('search deals', 'hubspot_search_deals', 'fail', errorMessage(error)));
      }
    }
    if (tools['hubspot_search_tickets']) {
      try {
        await call('hubspot_search_tickets', { subject: runId });
        steps.push(makeStep('search tickets', 'hubspot_search_tickets', 'pass'));
      } catch (error) {
        steps.push(makeStep('search tickets', 'hubspot_search_tickets', 'fail', errorMessage(error)));
      }
    }

    // Note creation: there is no delete-note tool, so a successful create
    // would leak an engagement. Probe with a synthetic association target —
    // HubSpot rejects the unknown object id, proving routing + validation.
    if (tools['hubspot_create_note']) {
      steps.push(
        await probeTool(call, tools, 'create note (probe)', 'hubspot_create_note', {
          body: `${runId} smoke note`,
          timestamp: new Date().toISOString(),
          association: { objectType: 'contact', objectId: '999999999999999' },
        }),
      );
    }

    // Batch company create: real create, then delete the created record so
    // nothing leaks.
    if (tools['hubspot_batch_create_companies']) {
      let batchCompanyId: string | undefined;
      try {
        const batch = await call<{ companies?: Array<{ id: string }> }>('hubspot_batch_create_companies', {
          companies: [{ name: `${runId} batch co`, domain: `batch-${runId}.mastra-smoke.invalid` }],
        });
        batchCompanyId = batch.companies?.[0]?.id;
        steps.push(makeStep('batch create companies', 'hubspot_batch_create_companies', 'pass', batchCompanyId));
      } catch (error) {
        steps.push(makeStep('batch create companies', 'hubspot_batch_create_companies', 'fail', errorMessage(error)));
      }
      if (batchCompanyId && tools['hubspot_delete_company']) {
        try {
          await call('hubspot_delete_company', { id: batchCompanyId });
          steps.push(makeStep('delete batch company', 'hubspot_delete_company', 'pass'));
        } catch (error) {
          log.error(`Failed to delete smoke batch company ${batchCompanyId} — clean up manually.`, {
            error: errorMessage(error),
          });
          steps.push(makeStep('delete batch company', 'hubspot_delete_company', 'fail', errorMessage(error)));
        }
      } else if (batchCompanyId) {
        log.error(`Leaked smoke batch company ${batchCompanyId}: hubspot_delete_company unavailable.`);
        steps.push(
          makeStep('delete batch company', 'hubspot_delete_company', 'fail', `leaked company ${batchCompanyId}`),
        );
      }
    }
    if (companyId && tools['hubspot_batch_update_companies']) {
      try {
        await call('hubspot_batch_update_companies', {
          companies: [{ id: companyId, name: `${runId} smoke company (batched)` }],
        });
        steps.push(makeStep('batch update companies', 'hubspot_batch_update_companies', 'pass'));
      } catch (error) {
        steps.push(makeStep('batch update companies', 'hubspot_batch_update_companies', 'fail', errorMessage(error)));
      }
    }

    // Property + user + owner + marketing-email + workflow probes. Writes
    // target reserved domains / synthetic ids and either succeed or surface
    // the HubSpot 4xx that proves the endpoint is wired.
    if (tools['hubspot_create_property']) {
      // There is no delete-property tool, so the probe input must be one the
      // API rejects: a nonexistent property group → HubSpot 400, no property
      // is created.
      steps.push(
        await probeTool(call, tools, 'create property (probe)', 'hubspot_create_property', {
          objectType: 'contacts',
          name: `mastra_smoke_${runId.replace(/-/g, '_')}`,
          label: `Mastra smoke ${runId}`,
          type: 'string',
          fieldType: 'text',
          groupName: `nonexistent_group_${runId.replace(/-/g, '_')}`,
        }),
      );
    }
    if (tools['hubspot_create_user']) {
      // User provisioning is scope/tier gated on many portals (403) — opt in.
      // If create actually succeeds, the delete_user probe below removes the
      // same email, so nothing leaks.
      steps.push(
        await probeTool(
          call,
          tools,
          'create user (probe)',
          'hubspot_create_user',
          {
            email: `mastra-smoke+${runId}@mastra-smoke.invalid`,
            firstName: 'Mastra',
            lastName: `Smoke-${runId}`,
            sendWelcomeEmail: false,
          },
          /status=(400|403|404|409|422)|not found/i,
        ),
      );
    }
    if (tools['hubspot_change_user_role']) {
      steps.push(
        await probeTool(
          call,
          tools,
          'change user role (probe)',
          'hubspot_change_user_role',
          {
            userId: `mastra-smoke+${runId}@mastra-smoke.invalid`,
            idProperty: 'EMAIL',
            roleId: '0',
          },
          /status=(400|403|404|409|422)|not found/i,
        ),
      );
    }
    if (tools['hubspot_delete_user']) {
      steps.push(
        await probeTool(
          call,
          tools,
          'delete user (probe)',
          'hubspot_delete_user',
          {
            userId: `mastra-smoke+${runId}@mastra-smoke.invalid`,
            idProperty: 'EMAIL',
          },
          /status=(400|403|404|409|422)|not found/i,
        ),
      );
    }
    if (tools['hubspot_get_owner']) {
      steps.push(await probeTool(call, tools, 'get owner (probe)', 'hubspot_get_owner', { ownerId: '0' }));
    }

    // fetch_roles only exists on Enterprise portals; non-Enterprise returns
    // 400 "unknown". Use probeTool so standard dev portals don't fail the run.
    if (tools['hubspot_fetch_roles']) {
      steps.push(await probeTool(call, tools, 'fetch roles (probe)', 'hubspot_fetch_roles', {}));
    }

    // Marketing email endpoints require Marketing Hub + the "marketing-email"
    // optional scope. On portals without Marketing Hub the OAuth consent step
    // silently drops the scope, so these come back 403. Use probeTool to
    // accept 403 as "endpoint exercised, product tier unavailable" while
    // still exercising the full lifecycle on Marketing Hub portals.
    const marketingListStep = await probeTool(
      call,
      tools,
      'list marketing emails (probe)',
      'hubspot_list_marketing_emails',
      {},
      // Marketing Hub product tier: 403 is the expected proof on portals
      // without it (opt-in — the default probe regex excludes 403).
      /status=(400|403|404|409|422)|not found|scopes are required/i,
    );
    if (tools['hubspot_list_marketing_emails']) {
      steps.push(marketingListStep);
    }

    let marketingEmailId: string | undefined;
    if (tools['hubspot_create_marketing_email']) {
      try {
        const email = await call<{ id?: string }>('hubspot_create_marketing_email', {
          name: `${runId} smoke email`,
          subject: `${runId} smoke subject`,
          htmlBody: '<p>mastra smoke</p>',
          textBody: 'mastra smoke',
        });
        marketingEmailId = email.id;
        steps.push(makeStep('create marketing email', 'hubspot_create_marketing_email', 'pass', marketingEmailId));
      } catch (error) {
        // 403 here means the portal doesn't have Marketing Hub — treat as
        // probe success so the overall run isn't held hostage to product tier.
        const msg = errorMessage(error);
        if (/status=403|forbidden|scopes are required/i.test(msg)) {
          steps.push(
            makeStep(
              'create marketing email (probe)',
              'hubspot_create_marketing_email',
              'pass',
              `expected error (endpoint exercised): ${msg.slice(0, 120)}`,
            ),
          );
        } else {
          steps.push(makeStep('create marketing email', 'hubspot_create_marketing_email', 'fail', msg));
        }
      }
    }
    if (marketingEmailId && tools['hubspot_get_marketing_email']) {
      try {
        await call('hubspot_get_marketing_email', { emailId: marketingEmailId });
        steps.push(makeStep('get marketing email', 'hubspot_get_marketing_email', 'pass'));
      } catch (error) {
        steps.push(makeStep('get marketing email', 'hubspot_get_marketing_email', 'fail', errorMessage(error)));
      }
    }
    if (marketingEmailId && tools['hubspot_update_marketing_email']) {
      try {
        await call('hubspot_update_marketing_email', { emailId: marketingEmailId, name: `${runId} smoke (edit)` });
        steps.push(makeStep('update marketing email', 'hubspot_update_marketing_email', 'pass'));
      } catch (error) {
        steps.push(makeStep('update marketing email', 'hubspot_update_marketing_email', 'fail', errorMessage(error)));
      }
    }
    let clonedMarketingEmailId: string | undefined;
    if (marketingEmailId && tools['hubspot_clone_marketing_email']) {
      try {
        const clone = await call<{ id?: string }>('hubspot_clone_marketing_email', {
          emailId: marketingEmailId,
          cloneName: `${runId} clone`,
        });
        clonedMarketingEmailId = clone?.id;
        steps.push(makeStep('clone marketing email', 'hubspot_clone_marketing_email', 'pass', clonedMarketingEmailId));
      } catch (error) {
        steps.push(makeStep('clone marketing email', 'hubspot_clone_marketing_email', 'fail', errorMessage(error)));
      }
    }
    if (clonedMarketingEmailId && tools['hubspot_delete_marketing_email']) {
      try {
        await call('hubspot_delete_marketing_email', { emailId: clonedMarketingEmailId });
        steps.push(makeStep('delete cloned marketing email', 'hubspot_delete_marketing_email', 'pass'));
      } catch (error) {
        log.error(`Failed to delete cloned smoke marketing email ${clonedMarketingEmailId}`, errorMessage(error));
        steps.push(
          makeStep('delete cloned marketing email', 'hubspot_delete_marketing_email', 'fail', errorMessage(error)),
        );
      }
    }
    if (marketingEmailId && tools['hubspot_delete_marketing_email']) {
      try {
        await call('hubspot_delete_marketing_email', { emailId: marketingEmailId });
        steps.push(makeStep('delete marketing email', 'hubspot_delete_marketing_email', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke marketing email ${marketingEmailId}`, errorMessage(error));
        steps.push(makeStep('delete marketing email', 'hubspot_delete_marketing_email', 'fail', errorMessage(error)));
      }
    } else if (tools['hubspot_delete_marketing_email']) {
      steps.push(
        await probeTool(call, tools, 'delete marketing email (probe)', 'hubspot_delete_marketing_email', {
          emailId: `smoke-${runId}`,
        }),
      );
    }

    // Workflow delete probe (requires existing workflow id — probe with synthetic).
    if (tools['hubspot_delete_a_workflow']) {
      steps.push(
        await probeTool(call, tools, 'delete workflow (probe)', 'hubspot_delete_a_workflow', {
          workflowId: `smoke-${runId}`,
        }),
      );
    }

    // Form submit probe (requires portal + form guid — probe with synthetics).
    if (tools['hubspot_submit_form']) {
      steps.push(
        await probeTool(call, tools, 'submit form (probe)', 'hubspot_submit_form', {
          portal_id: '0',
          form_guid: '00000000-0000-0000-0000-000000000000',
          fields: [{ name: 'email', value: `smoke+${runId}@mastra-smoke.invalid` }],
        }),
      );
    }

    if (taskId && tools['hubspot_delete_task']) {
      try {
        await call('hubspot_delete_task', { taskId });
        steps.push(makeStep('delete task', 'hubspot_delete_task', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke task ${taskId}`, errorMessage(error));
        steps.push(makeStep('delete task', 'hubspot_delete_task', 'fail', errorMessage(error)));
      }
    }

    if (ticketId && tools['hubspot_delete_ticket']) {
      try {
        await call('hubspot_delete_ticket', { ticketId });
        steps.push(makeStep('delete ticket', 'hubspot_delete_ticket', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke ticket ${ticketId}`, errorMessage(error));
        steps.push(makeStep('delete ticket', 'hubspot_delete_ticket', 'fail', errorMessage(error)));
      }
    }

    if (dealId && tools['hubspot_delete_deal']) {
      try {
        await call('hubspot_delete_deal', { dealId });
        steps.push(makeStep('delete deal', 'hubspot_delete_deal', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke deal ${dealId}`, errorMessage(error));
        steps.push(makeStep('delete deal', 'hubspot_delete_deal', 'fail', errorMessage(error)));
      }
    }

    if (companyId && tools['hubspot_delete_company']) {
      try {
        await call('hubspot_delete_company', { id: companyId });
        steps.push(makeStep('delete company', 'hubspot_delete_company', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke company ${companyId}`, errorMessage(error));
        steps.push(makeStep('delete company', 'hubspot_delete_company', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('hubspot_delete_contact', { contactId });
      steps.push(makeStep('delete contact', 'hubspot_delete_contact', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke contact ${contactId}`, errorMessage(error));
      steps.push(makeStep('delete contact', 'hubspot_delete_contact', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
