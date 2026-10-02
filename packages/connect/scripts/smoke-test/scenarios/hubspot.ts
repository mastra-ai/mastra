import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

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
          ['hubspot_fetch_roles', {}],
          ['hubspot_list_contacts', { limit: 5 }],
          ['hubspot_list_companies', { limit: 5 }],
          ['hubspot_list_deals', { limit: 5 }],
          ['hubspot_list_tickets', { limit: 5 }],
          ['hubspot_list_forms', { limit: 5 }],
        ],
        tools,
      )),
    );

    const emailDomain = `${runId}.mastra-smoke.invalid`;
    let contactId: string | undefined;
    try {
      const contact = await call<{ id: string }>('hubspot_create_contact', {
        properties: {
          email: `smoke+${runId}@${emailDomain}`,
          firstname: 'Mastra',
          lastname: `Smoke-${runId}`,
        },
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
        properties: { company: 'mastra-smoke' },
      });
      steps.push(makeStep('update contact', 'hubspot_update_contact', 'pass'));
    } catch (error) {
      steps.push(makeStep('update contact', 'hubspot_update_contact', 'fail', errorMessage(error)));
    }

    let companyId: string | undefined;
    if (tools['hubspot_create_company']) {
      try {
        const company = await call<{ id: string }>('hubspot_create_company', {
          properties: { name: `${runId} smoke company`, domain: emailDomain },
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
          properties: {
            dealname: `${runId} smoke deal`,
            amount: '1',
          },
        });
        dealId = deal.id;
        steps.push(makeStep('create deal', 'hubspot_create_deal', 'pass', dealId));
      } catch (error) {
        steps.push(makeStep('create deal', 'hubspot_create_deal', 'fail', errorMessage(error)));
      }
    }

    let ticketId: string | undefined;
    if (tools['hubspot_create_ticket']) {
      try {
        const ticket = await call<{ id: string }>('hubspot_create_ticket', {
          properties: { subject: `${runId} smoke ticket` },
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
        const task = await call<{ id: string }>('hubspot_create_task', {
          properties: { hs_task_subject: `${runId} smoke task`, hs_task_status: 'NOT_STARTED' },
        });
        taskId = task.id;
        steps.push(makeStep('create task', 'hubspot_create_task', 'pass', taskId));
      } catch (error) {
        steps.push(makeStep('create task', 'hubspot_create_task', 'fail', errorMessage(error)));
      }
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
        await call('hubspot_delete_company', { companyId });
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
