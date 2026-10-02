import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep incident.io scenario: follow-up + action CRUD plus the broad read-only
 * catalog/incident/schedule surface. Creating or transitioning real incidents
 * is intentionally out of scope — those drive paging and side effects.
 */
export const incidentIoScenario: Scenario = {
  integrationId: 'incident-io',
  summary: 'follow-up + action CRUD + catalog/incident reads',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['incident_io_create_follow_up', 'incident_io_delete_follow_up']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const incidents = await call<{ items?: Array<{ id?: string }> }>('incident_io_list_incidents', { pageSize: 1 });
    const incidentId = incidents.items?.[0]?.id;
    if (!incidentId) {
      steps.push(makeStep('pick incident', 'incident_io_list_incidents', 'skip', 'No incidents visible to the token.'));
      return steps;
    }
    steps.push(makeStep('pick incident', 'incident_io_list_incidents', 'pass', incidentId));

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['incident_io_list_users', { pageSize: 5 }],
          ['incident_io_list_teams', { pageSize: 5 }],
          ['incident_io_list_severities', {}],
          ['incident_io_list_incident_types', {}],
          ['incident_io_list_incident_statuses', {}],
          ['incident_io_list_incident_roles', {}],
          ['incident_io_list_schedules', { pageSize: 5 }],
          ['incident_io_list_catalog_types', { pageSize: 5 }],
          ['incident_io_list_follow_ups', { pageSize: 5 }],
          ['incident_io_list_actions', { pageSize: 5 }],
        ],
        tools,
      )),
    );

    let followUpId: string | undefined;
    try {
      const followUp = await call<{ id: string }>('incident_io_create_follow_up', {
        incidentId,
        title: `${runId} smoke follow-up`,
        description: 'Automated @mastra/connect smoke test. Safe to delete.',
      });
      followUpId = followUp.id;
      steps.push(makeStep('create follow-up', 'incident_io_create_follow_up', 'pass', followUpId));
    } catch (error) {
      steps.push(makeStep('create follow-up', 'incident_io_create_follow_up', 'fail', errorMessage(error)));
    }

    if (followUpId && tools['incident_io_update_follow_up']) {
      try {
        await call('incident_io_update_follow_up', {
          followUpId,
          title: `${runId} smoke follow-up (edited)`,
        });
        steps.push(makeStep('update follow-up', 'incident_io_update_follow_up', 'pass'));
      } catch (error) {
        steps.push(makeStep('update follow-up', 'incident_io_update_follow_up', 'fail', errorMessage(error)));
      }
    }

    if (followUpId && tools['incident_io_get_follow_up']) {
      try {
        await call('incident_io_get_follow_up', { followUpId });
        steps.push(makeStep('read follow-up', 'incident_io_get_follow_up', 'pass'));
      } catch (error) {
        steps.push(makeStep('read follow-up', 'incident_io_get_follow_up', 'fail', errorMessage(error)));
      }
    }

    if (followUpId) {
      try {
        await call('incident_io_delete_follow_up', { followUpId });
        steps.push(makeStep('delete follow-up', 'incident_io_delete_follow_up', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke follow-up ${followUpId}`, errorMessage(error));
        steps.push(makeStep('delete follow-up', 'incident_io_delete_follow_up', 'fail', errorMessage(error)));
      }
    }

    return steps;
  },
};
