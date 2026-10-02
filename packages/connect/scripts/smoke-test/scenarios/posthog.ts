import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep PostHog scenario: dashboard + insight + cohort + annotation CRUD plus
 * the broad read-only project surface.
 */
export const posthogScenario: Scenario = {
  integrationId: 'posthog',
  summary: 'dashboard + insight + cohort + annotation CRUD',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'posthog_list_projects',
      'posthog_create_dashboard',
      'posthog_get_dashboard',
      'posthog_delete_dashboard',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const projects = await call<{ items?: Array<{ id?: number }> }>('posthog_list_projects', {});
    const projectId = projects.items?.[0]?.id;
    if (!projectId) {
      steps.push(makeStep('pick project', 'posthog_list_projects', 'skip', 'No PostHog project visible.'));
      return steps;
    }
    steps.push(makeStep('pick project', 'posthog_list_projects', 'pass', String(projectId)));

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['posthog_get_project', { projectId }],
          ['posthog_list_dashboards', { projectId, limit: 5 }],
          ['posthog_list_insights', { projectId, limit: 5 }],
          ['posthog_list_cohorts', { projectId, limit: 5 }],
          ['posthog_list_feature_flags', { projectId, limit: 5 }],
          ['posthog_list_events', { projectId, limit: 5 }],
          ['posthog_list_persons', { projectId, limit: 5 }],
          ['posthog_list_actions', { projectId, limit: 5 }],
          ['posthog_list_annotations', { projectId, limit: 5 }],
          ['posthog_list_experiments', { projectId, limit: 5 }],
          ['posthog_list_surveys', { projectId, limit: 5 }],
          ['posthog_list_event_definitions', { projectId, limit: 5 }],
          ['posthog_list_property_definitions', { projectId, limit: 5 }],
        ],
        tools,
      )),
    );

    let dashboardId: number | undefined;
    try {
      const dashboard = await call<{ id: number }>('posthog_create_dashboard', {
        projectId,
        name: `${runId} smoke dashboard`,
      });
      dashboardId = dashboard.id;
      steps.push(makeStep('create dashboard', 'posthog_create_dashboard', 'pass', String(dashboardId)));
    } catch (error) {
      steps.push(makeStep('create dashboard', 'posthog_create_dashboard', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      await call('posthog_get_dashboard', { projectId, dashboardId });
      steps.push(makeStep('read dashboard', 'posthog_get_dashboard', 'pass'));
    } catch (error) {
      steps.push(makeStep('read dashboard', 'posthog_get_dashboard', 'fail', errorMessage(error)));
    }

    if (tools['posthog_update_dashboard']) {
      try {
        await call('posthog_update_dashboard', {
          projectId,
          dashboardId,
          name: `${runId} smoke dashboard (renamed)`,
        });
        steps.push(makeStep('update dashboard', 'posthog_update_dashboard', 'pass'));
      } catch (error) {
        steps.push(makeStep('update dashboard', 'posthog_update_dashboard', 'fail', errorMessage(error)));
      }
    }

    let annotationId: number | undefined;
    if (tools['posthog_create_annotation']) {
      try {
        const ann = await call<{ id: number }>('posthog_create_annotation', {
          projectId,
          content: `${runId} smoke annotation`,
          dateMarker: new Date().toISOString(),
        });
        annotationId = ann.id;
        steps.push(makeStep('create annotation', 'posthog_create_annotation', 'pass', String(annotationId)));
      } catch (error) {
        steps.push(makeStep('create annotation', 'posthog_create_annotation', 'fail', errorMessage(error)));
      }
    }
    if (annotationId && tools['posthog_delete_annotation']) {
      try {
        await call('posthog_delete_annotation', { projectId, annotationId });
        steps.push(makeStep('delete annotation', 'posthog_delete_annotation', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke annotation ${annotationId}`, errorMessage(error));
        steps.push(makeStep('delete annotation', 'posthog_delete_annotation', 'fail', errorMessage(error)));
      }
    }

    let cohortId: number | undefined;
    if (tools['posthog_create_cohort']) {
      try {
        const cohort = await call<{ id: number }>('posthog_create_cohort', {
          projectId,
          name: `${runId} smoke cohort`,
          groups: [{ properties: [] }],
        });
        cohortId = cohort.id;
        steps.push(makeStep('create cohort', 'posthog_create_cohort', 'pass', String(cohortId)));
      } catch (error) {
        steps.push(makeStep('create cohort', 'posthog_create_cohort', 'fail', errorMessage(error)));
      }
    }
    if (cohortId && tools['posthog_delete_cohort']) {
      try {
        await call('posthog_delete_cohort', { projectId, cohortId });
        steps.push(makeStep('delete cohort', 'posthog_delete_cohort', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke cohort ${cohortId}`, errorMessage(error));
        steps.push(makeStep('delete cohort', 'posthog_delete_cohort', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('posthog_delete_dashboard', { projectId, dashboardId });
      steps.push(makeStep('delete dashboard', 'posthog_delete_dashboard', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke dashboard ${dashboardId}`, errorMessage(error));
      steps.push(makeStep('delete dashboard', 'posthog_delete_dashboard', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
