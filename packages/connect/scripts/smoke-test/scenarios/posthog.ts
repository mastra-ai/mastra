import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep PostHog scenario: dashboard + insight + action + feature-flag + experiment
 * + alert + early-access-feature + survey + person + cohort + annotation CRUD.
 *
 * NOTE: The generated PostHog tools mix camelCase and snake_case for the project
 * identifier — older dashboard/project tools expect `projectId`, newer tools
 * expect `project_id`. We pass whichever each tool actually requires. The
 * project ID is sent as a string for tools that require string, cast to Number
 * for those that require numeric.
 */
export const posthogScenario: Scenario = {
  integrationId: 'posthog',
  summary: 'dashboard + insight + action + flag + experiment + alert + survey + person + cohort + annotation CRUD',
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

    const pidStr = String(projectId);
    const pidNum = Number(projectId);

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
          ['posthog_list_alerts', { project_id: pidStr, limit: 5 }],
          ['posthog_list_early_access_features', { project_id: pidStr, limit: 5 }],
          ['posthog_list_session_recordings', { project_id: pidStr, limit: 5 }],
        ],
        tools,
      )),
    );

    // ---- dashboard ----
    let dashboardId: number | undefined;
    try {
      const dashboard = await call<{ id: number }>('posthog_create_dashboard', {
        project_id: projectId,
        name: `${runId} smoke dashboard`,
      });
      dashboardId = dashboard.id;
      steps.push(makeStep('create dashboard', 'posthog_create_dashboard', 'pass', String(dashboardId)));
    } catch (error) {
      steps.push(makeStep('create dashboard', 'posthog_create_dashboard', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      await call('posthog_get_dashboard', { project_id: projectId, id: dashboardId });
      steps.push(makeStep('read dashboard', 'posthog_get_dashboard', 'pass'));
    } catch (error) {
      steps.push(makeStep('read dashboard', 'posthog_get_dashboard', 'fail', errorMessage(error)));
    }

    if (tools['posthog_update_dashboard']) {
      try {
        await call('posthog_update_dashboard', {
          project_id: projectId,
          id: dashboardId,
          name: `${runId} smoke dashboard (renamed)`,
        });
        steps.push(makeStep('update dashboard', 'posthog_update_dashboard', 'pass'));
      } catch (error) {
        steps.push(makeStep('update dashboard', 'posthog_update_dashboard', 'fail', errorMessage(error)));
      }
    }

    // ---- insight ----
    let insightId: number | undefined;
    if (tools['posthog_create_insight']) {
      try {
        const insight = await call<{ id: number }>('posthog_create_insight', {
          project_id: pidStr,
          name: `${runId} smoke insight`,
          query: {
            kind: 'InsightVizNode',
            source: {
              kind: 'TrendsQuery',
              series: [{ kind: 'EventsNode', event: '$pageview' }],
            },
          },
        });
        insightId = insight.id;
        steps.push(makeStep('create insight', 'posthog_create_insight', 'pass', String(insightId)));
      } catch (error) {
        steps.push(makeStep('create insight', 'posthog_create_insight', 'fail', errorMessage(error)));
      }
    }
    if (insightId && tools['posthog_get_insight']) {
      try {
        await call('posthog_get_insight', { project_id: pidNum, insight_id: insightId });
        steps.push(makeStep('read insight', 'posthog_get_insight', 'pass'));
      } catch (error) {
        steps.push(makeStep('read insight', 'posthog_get_insight', 'fail', errorMessage(error)));
      }
    }
    if (insightId && tools['posthog_update_insight']) {
      try {
        await call('posthog_update_insight', {
          project_id: pidStr,
          id: insightId,
          name: `${runId} smoke insight (updated)`,
        });
        steps.push(makeStep('update insight', 'posthog_update_insight', 'pass'));
      } catch (error) {
        steps.push(makeStep('update insight', 'posthog_update_insight', 'fail', errorMessage(error)));
      }
    }

    // ---- action ----
    let actionId: number | undefined;
    if (tools['posthog_create_action']) {
      try {
        const action = await call<{ id: number }>('posthog_create_action', {
          project_id: pidNum,
          name: `${runId} smoke action`,
          description: 'Smoke action for routing validation.',
        });
        actionId = action.id;
        steps.push(makeStep('create action', 'posthog_create_action', 'pass', String(actionId)));
      } catch (error) {
        steps.push(makeStep('create action', 'posthog_create_action', 'fail', errorMessage(error)));
      }
    }
    if (actionId && tools['posthog_get_action']) {
      try {
        await call('posthog_get_action', { project_id: pidStr, id: actionId });
        steps.push(makeStep('read action', 'posthog_get_action', 'pass'));
      } catch (error) {
        steps.push(makeStep('read action', 'posthog_get_action', 'fail', errorMessage(error)));
      }
    }
    if (actionId && tools['posthog_update_action']) {
      try {
        await call('posthog_update_action', {
          project_id: pidStr,
          id: actionId,
          name: `${runId} smoke action (updated)`,
        });
        steps.push(makeStep('update action', 'posthog_update_action', 'pass'));
      } catch (error) {
        steps.push(makeStep('update action', 'posthog_update_action', 'fail', errorMessage(error)));
      }
    }

    // ---- feature flag ----
    let featureFlagId: number | undefined;
    const flagKey = `smoke-flag-${runId}`;
    if (tools['posthog_create_feature_flag']) {
      try {
        const flag = await call<{ id: number }>('posthog_create_feature_flag', {
          project_id: pidStr,
          key: flagKey,
          name: `${runId} smoke flag`,
          active: false,
        });
        featureFlagId = flag.id;
        steps.push(makeStep('create feature flag', 'posthog_create_feature_flag', 'pass', String(featureFlagId)));
      } catch (error) {
        steps.push(makeStep('create feature flag', 'posthog_create_feature_flag', 'fail', errorMessage(error)));
      }
    }
    if (featureFlagId && tools['posthog_get_feature_flag']) {
      try {
        await call('posthog_get_feature_flag', { project_id: pidStr, id: featureFlagId });
        steps.push(makeStep('read feature flag', 'posthog_get_feature_flag', 'pass'));
      } catch (error) {
        steps.push(makeStep('read feature flag', 'posthog_get_feature_flag', 'fail', errorMessage(error)));
      }
    }
    if (featureFlagId && tools['posthog_update_feature_flag']) {
      try {
        await call('posthog_update_feature_flag', {
          project_id: pidStr,
          id: featureFlagId,
          name: `${runId} smoke flag (updated)`,
        });
        steps.push(makeStep('update feature flag', 'posthog_update_feature_flag', 'pass'));
      } catch (error) {
        steps.push(makeStep('update feature flag', 'posthog_update_feature_flag', 'fail', errorMessage(error)));
      }
    }

    // ---- experiment (requires feature flag) ----
    let experimentId: number | undefined;
    if (featureFlagId && tools['posthog_create_experiment']) {
      try {
        const exp = await call<{ id: number }>('posthog_create_experiment', {
          project_id: pidStr,
          name: `${runId} smoke experiment`,
          feature_flag_key: flagKey,
          parameters: {},
        });
        experimentId = exp.id;
        steps.push(makeStep('create experiment', 'posthog_create_experiment', 'pass', String(experimentId)));
      } catch (error) {
        steps.push(makeStep('create experiment', 'posthog_create_experiment', 'fail', errorMessage(error)));
      }
    } else if (tools['posthog_create_experiment']) {
      steps.push(
        await probeTool(call, tools, 'create experiment', 'posthog_create_experiment', {
          project_id: pidStr,
          name: `${runId} smoke experiment`,
          feature_flag_key: `smoke-missing-${runId}`,
          parameters: {},
        }),
      );
    }
    if (experimentId && tools['posthog_get_experiment']) {
      try {
        await call('posthog_get_experiment', { project_id: pidNum, id: experimentId });
        steps.push(makeStep('read experiment', 'posthog_get_experiment', 'pass'));
      } catch (error) {
        steps.push(makeStep('read experiment', 'posthog_get_experiment', 'fail', errorMessage(error)));
      }
    }
    if (experimentId && tools['posthog_update_experiment']) {
      try {
        await call('posthog_update_experiment', {
          project_id: pidStr,
          id: experimentId,
          name: `${runId} smoke experiment (updated)`,
          archived: true,
        });
        steps.push(makeStep('update experiment', 'posthog_update_experiment', 'pass'));
      } catch (error) {
        steps.push(makeStep('update experiment', 'posthog_update_experiment', 'fail', errorMessage(error)));
      }
    }

    // ---- alert (requires insight) ----
    let alertId: string | undefined;
    if (insightId && tools['posthog_create_alert']) {
      try {
        const alert = await call<{ id: string }>('posthog_create_alert', {
          project_id: pidStr,
          insight: insightId,
          name: `${runId} smoke alert`,
          condition_type: 'absolute_value',
          threshold_type: 'absolute',
          threshold_upper: 100,
          enabled: false,
        });
        alertId = alert.id;
        steps.push(makeStep('create alert', 'posthog_create_alert', 'pass', alertId));
      } catch (error) {
        steps.push(makeStep('create alert', 'posthog_create_alert', 'fail', errorMessage(error)));
      }
    } else if (tools['posthog_create_alert']) {
      steps.push(
        await probeTool(call, tools, 'create alert', 'posthog_create_alert', {
          project_id: pidStr,
          insight: 1,
          name: `${runId} smoke alert`,
          condition_type: 'absolute_value',
          threshold_type: 'absolute',
          threshold_upper: 100,
          enabled: false,
        }),
      );
    }
    if (alertId && tools['posthog_get_alert']) {
      try {
        await call('posthog_get_alert', { project_id: pidStr, id: alertId });
        steps.push(makeStep('read alert', 'posthog_get_alert', 'pass'));
      } catch (error) {
        steps.push(makeStep('read alert', 'posthog_get_alert', 'fail', errorMessage(error)));
      }
    }
    if (alertId && tools['posthog_update_alert']) {
      try {
        await call('posthog_update_alert', { project_id: pidStr, id: alertId, name: `${runId} smoke alert (updated)` });
        steps.push(makeStep('update alert', 'posthog_update_alert', 'pass'));
      } catch (error) {
        steps.push(makeStep('update alert', 'posthog_update_alert', 'fail', errorMessage(error)));
      }
    }
    if (alertId && tools['posthog_delete_alert']) {
      try {
        await call('posthog_delete_alert', { project_id: pidStr, id: alertId });
        steps.push(makeStep('delete alert', 'posthog_delete_alert', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke alert ${alertId}`, errorMessage(error));
        steps.push(makeStep('delete alert', 'posthog_delete_alert', 'fail', errorMessage(error)));
      }
    }

    // ---- early access feature (requires feature flag) ----
    let eafId: string | undefined;
    if (featureFlagId && tools['posthog_create_early_access_feature']) {
      try {
        const eaf = await call<{ id: string }>('posthog_create_early_access_feature', {
          project_id: pidNum,
          name: `${runId} smoke EAF`,
          description: 'Smoke EAF for routing validation.',
          stage: 'concept',
          feature_flag_id: featureFlagId,
        });
        eafId = eaf.id;
        steps.push(makeStep('create early access feature', 'posthog_create_early_access_feature', 'pass', eafId));
      } catch (error) {
        steps.push(
          makeStep('create early access feature', 'posthog_create_early_access_feature', 'fail', errorMessage(error)),
        );
      }
    } else if (tools['posthog_create_early_access_feature']) {
      steps.push(
        await probeTool(call, tools, 'create early access feature', 'posthog_create_early_access_feature', {
          project_id: pidNum,
          name: `${runId} smoke EAF`,
          stage: 'concept',
        }),
      );
    }
    if (eafId && tools['posthog_get_early_access_feature']) {
      try {
        await call('posthog_get_early_access_feature', { project_id: pidStr, id: eafId });
        steps.push(makeStep('read early access feature', 'posthog_get_early_access_feature', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('read early access feature', 'posthog_get_early_access_feature', 'fail', errorMessage(error)),
        );
      }
    }
    if (eafId && tools['posthog_update_early_access_feature']) {
      try {
        await call('posthog_update_early_access_feature', {
          project_id: pidStr,
          id: eafId,
          stage: 'beta',
        });
        steps.push(makeStep('update early access feature', 'posthog_update_early_access_feature', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('update early access feature', 'posthog_update_early_access_feature', 'fail', errorMessage(error)),
        );
      }
    }
    if (eafId && tools['posthog_delete_early_access_feature']) {
      try {
        await call('posthog_delete_early_access_feature', { project_id: pidStr, id: eafId });
        steps.push(makeStep('delete early access feature', 'posthog_delete_early_access_feature', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke EAF ${eafId}`, errorMessage(error));
        steps.push(
          makeStep('delete early access feature', 'posthog_delete_early_access_feature', 'fail', errorMessage(error)),
        );
      }
    }

    // ---- survey ----
    let surveyId: string | undefined;
    if (tools['posthog_create_survey']) {
      try {
        const survey = await call<{ id: string }>('posthog_create_survey', {
          project_id: pidStr,
          name: `${runId} smoke survey`,
          type: 'api',
          description: 'Smoke survey.',
        });
        surveyId = survey.id;
        steps.push(makeStep('create survey', 'posthog_create_survey', 'pass', surveyId));
      } catch (error) {
        steps.push(makeStep('create survey', 'posthog_create_survey', 'fail', errorMessage(error)));
      }
    }
    if (surveyId && tools['posthog_get_survey']) {
      try {
        await call('posthog_get_survey', { project_id: pidStr, id: surveyId });
        steps.push(makeStep('read survey', 'posthog_get_survey', 'pass'));
      } catch (error) {
        steps.push(makeStep('read survey', 'posthog_get_survey', 'fail', errorMessage(error)));
      }
    }
    if (surveyId && tools['posthog_update_survey']) {
      try {
        await call('posthog_update_survey', {
          project_id: pidNum,
          survey_id: surveyId,
          name: `${runId} smoke survey (updated)`,
        });
        steps.push(makeStep('update survey', 'posthog_update_survey', 'pass'));
      } catch (error) {
        steps.push(makeStep('update survey', 'posthog_update_survey', 'fail', errorMessage(error)));
      }
    }
    if (surveyId && tools['posthog_delete_survey']) {
      try {
        await call('posthog_delete_survey', { project_id: pidStr, id: surveyId });
        steps.push(makeStep('delete survey', 'posthog_delete_survey', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke survey ${surveyId}`, errorMessage(error));
        steps.push(makeStep('delete survey', 'posthog_delete_survey', 'fail', errorMessage(error)));
      }
    }

    // ---- person ----
    const distinctId = `smoke-user-${runId}`;
    let personId: string | undefined;
    if (tools['posthog_create_person']) {
      try {
        const person = await call<{ id?: string; uuid?: string }>('posthog_create_person', {
          project_id: pidStr,
          distinct_id: distinctId,
          properties: { email: `smoke+${runId}@mastra-smoke.invalid`, source: 'mastra-smoke' },
        });
        personId = person.uuid ?? person.id;
        steps.push(makeStep('create person', 'posthog_create_person', 'pass', personId));
      } catch (error) {
        steps.push(makeStep('create person', 'posthog_create_person', 'fail', errorMessage(error)));
      }
    }
    if (tools['posthog_identify_person']) {
      try {
        await call('posthog_identify_person', {
          project_id: pidNum,
          distinct_id: distinctId,
          properties: { smoke: true, runId },
        });
        steps.push(makeStep('identify person', 'posthog_identify_person', 'pass'));
      } catch (error) {
        steps.push(makeStep('identify person', 'posthog_identify_person', 'fail', errorMessage(error)));
      }
    }
    if (personId && tools['posthog_get_person']) {
      try {
        await call('posthog_get_person', { project_id: pidNum, id: personId });
        steps.push(makeStep('read person', 'posthog_get_person', 'pass'));
      } catch (error) {
        steps.push(makeStep('read person', 'posthog_get_person', 'fail', errorMessage(error)));
      }
    } else if (tools['posthog_get_person']) {
      steps.push(
        await probeTool(call, tools, 'read person', 'posthog_get_person', { project_id: pidNum, id: distinctId }),
      );
    }
    if (personId && tools['posthog_update_person']) {
      try {
        await call('posthog_update_person', {
          project_id: pidStr,
          person_id: personId,
          properties: { updated_by: 'mastra-smoke' },
        });
        steps.push(makeStep('update person', 'posthog_update_person', 'pass'));
      } catch (error) {
        steps.push(makeStep('update person', 'posthog_update_person', 'fail', errorMessage(error)));
      }
    } else if (tools['posthog_update_person']) {
      steps.push(
        await probeTool(call, tools, 'update person', 'posthog_update_person', {
          project_id: pidStr,
          person_id: `smoke-missing-${runId}`,
          properties: { runId },
        }),
      );
    }
    if (personId && tools['posthog_delete_person']) {
      try {
        await call('posthog_delete_person', { project_id: pidStr, person_id: personId });
        steps.push(makeStep('delete person', 'posthog_delete_person', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke person ${personId}`, errorMessage(error));
        steps.push(makeStep('delete person', 'posthog_delete_person', 'fail', errorMessage(error)));
      }
    } else if (tools['posthog_delete_person']) {
      steps.push(
        await probeTool(call, tools, 'delete person', 'posthog_delete_person', {
          project_id: pidStr,
          person_id: `smoke-missing-${runId}`,
        }),
      );
    }

    // ---- annotation ----
    let annotationId: number | undefined;
    if (tools['posthog_create_annotation']) {
      try {
        const ann = await call<{ id: number }>('posthog_create_annotation', {
          project_id: projectId,
          content: `${runId} smoke annotation`,
          date_marker: new Date().toISOString(),
        });
        annotationId = ann.id;
        steps.push(makeStep('create annotation', 'posthog_create_annotation', 'pass', String(annotationId)));
      } catch (error) {
        steps.push(makeStep('create annotation', 'posthog_create_annotation', 'fail', errorMessage(error)));
      }
    }
    if (annotationId && tools['posthog_get_annotation']) {
      try {
        await call('posthog_get_annotation', { project_id: pidNum, id: annotationId });
        steps.push(makeStep('read annotation', 'posthog_get_annotation', 'pass'));
      } catch (error) {
        steps.push(makeStep('read annotation', 'posthog_get_annotation', 'fail', errorMessage(error)));
      }
    }
    if (annotationId && tools['posthog_update_annotation']) {
      try {
        await call('posthog_update_annotation', {
          project_id: pidStr,
          id: annotationId,
          content: `${runId} smoke annotation (updated)`,
        });
        steps.push(makeStep('update annotation', 'posthog_update_annotation', 'pass'));
      } catch (error) {
        steps.push(makeStep('update annotation', 'posthog_update_annotation', 'fail', errorMessage(error)));
      }
    }
    if (annotationId && tools['posthog_delete_annotation']) {
      try {
        await call('posthog_delete_annotation', { project_id: projectId, annotation_id: annotationId });
        steps.push(makeStep('delete annotation', 'posthog_delete_annotation', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke annotation ${annotationId}`, errorMessage(error));
        steps.push(makeStep('delete annotation', 'posthog_delete_annotation', 'fail', errorMessage(error)));
      }
    }

    // ---- cohort ----
    let cohortId: number | undefined;
    if (tools['posthog_create_cohort']) {
      try {
        const cohort = await call<{ id: number }>('posthog_create_cohort', {
          project_id: projectId,
          name: `${runId} smoke cohort`,
          filters: { properties: { type: 'OR', values: [] } },
        });
        cohortId = cohort.id;
        steps.push(makeStep('create cohort', 'posthog_create_cohort', 'pass', String(cohortId)));
      } catch (error) {
        steps.push(makeStep('create cohort', 'posthog_create_cohort', 'fail', errorMessage(error)));
      }
    }
    if (cohortId && tools['posthog_get_cohort']) {
      try {
        await call('posthog_get_cohort', { project_id: pidStr, id: cohortId });
        steps.push(makeStep('read cohort', 'posthog_get_cohort', 'pass'));
      } catch (error) {
        steps.push(makeStep('read cohort', 'posthog_get_cohort', 'fail', errorMessage(error)));
      }
    }
    if (cohortId && tools['posthog_update_cohort']) {
      try {
        await call('posthog_update_cohort', {
          project_id: pidNum,
          id: cohortId,
          description: `${runId} smoke cohort (updated)`,
        });
        steps.push(makeStep('update cohort', 'posthog_update_cohort', 'pass'));
      } catch (error) {
        steps.push(makeStep('update cohort', 'posthog_update_cohort', 'fail', errorMessage(error)));
      }
    }
    if (cohortId && tools['posthog_delete_cohort']) {
      try {
        await call('posthog_delete_cohort', { project_id: projectId, cohort_id: cohortId });
        steps.push(makeStep('delete cohort', 'posthog_delete_cohort', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke cohort ${cohortId}`, errorMessage(error));
        steps.push(makeStep('delete cohort', 'posthog_delete_cohort', 'fail', errorMessage(error)));
      }
    }

    // ---- events, event/property definitions, query, capture ----
    if (tools['posthog_get_event']) {
      steps.push(
        await probeTool(call, tools, 'read event', 'posthog_get_event', {
          project_id: pidStr,
          id: `smoke-missing-event-${runId}`,
        }),
      );
    }
    if (tools['posthog_get_event_definition']) {
      steps.push(
        await probeTool(call, tools, 'read event definition', 'posthog_get_event_definition', {
          project_id: pidStr,
          id: `smoke-missing-eventdef-${runId}`,
        }),
      );
    }
    if (tools['posthog_get_property_definition']) {
      steps.push(
        await probeTool(call, tools, 'read property definition', 'posthog_get_property_definition', {
          project_id: pidStr,
          id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
        }),
      );
    }
    if (tools['posthog_update_property_definition']) {
      steps.push(
        await probeTool(call, tools, 'update property definition', 'posthog_update_property_definition', {
          project_id: pidStr,
          id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
          description: `${runId} smoke update`,
        }),
      );
    }
    if (tools['posthog_run_query']) {
      try {
        await call('posthog_run_query', {
          project_id: pidNum,
          query: 'select event, count() from events limit 1',
          name: `smoke-${runId}`,
        });
        steps.push(makeStep('run query', 'posthog_run_query', 'pass'));
      } catch (error) {
        steps.push(makeStep('run query', 'posthog_run_query', 'fail', errorMessage(error)));
      }
    }
    if (tools['posthog_capture_event']) {
      // capture_event requires the project write token (api_key), not the admin
      // key the smoke harness holds. Probe to exercise routing.
      steps.push(
        await probeTool(call, tools, 'capture event', 'posthog_capture_event', {
          api_key: 'phc_smoke_placeholder',
          event: 'mastra_smoke_event',
          distinct_id: distinctId,
          properties: { runId },
        }),
      );
    }

    // ---- cleanup downstream resources before dashboard delete ----
    // The provider ships no delete_experiment tool; archiving via
    // update_experiment is PostHog's soft delete, so the smoke experiment
    // doesn't linger in the active experiments list.
    if (experimentId && tools['posthog_update_experiment']) {
      try {
        await call('posthog_update_experiment', { project_id: pidStr, id: experimentId, archived: true });
        steps.push(makeStep('archive experiment (cleanup)', 'posthog_update_experiment', 'pass'));
      } catch (error) {
        log.error(`Failed to archive smoke experiment ${experimentId} — clean up manually.`, errorMessage(error));
        steps.push(makeStep('archive experiment (cleanup)', 'posthog_update_experiment', 'fail', errorMessage(error)));
      }
    }
    if (actionId && tools['posthog_delete_action']) {
      try {
        await call('posthog_delete_action', { project_id: pidStr, id: actionId });
        steps.push(makeStep('delete action', 'posthog_delete_action', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke action ${actionId}`, errorMessage(error));
        steps.push(makeStep('delete action', 'posthog_delete_action', 'fail', errorMessage(error)));
      }
    }
    if (insightId && tools['posthog_delete_insight']) {
      try {
        await call('posthog_delete_insight', { project_id: pidStr, id: insightId });
        steps.push(makeStep('delete insight', 'posthog_delete_insight', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke insight ${insightId}`, errorMessage(error));
        steps.push(makeStep('delete insight', 'posthog_delete_insight', 'fail', errorMessage(error)));
      }
    }
    if (featureFlagId && tools['posthog_delete_feature_flag']) {
      try {
        await call('posthog_delete_feature_flag', { project_id: pidStr, id: featureFlagId });
        steps.push(makeStep('delete feature flag', 'posthog_delete_feature_flag', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke feature flag ${featureFlagId}`, errorMessage(error));
        steps.push(makeStep('delete feature flag', 'posthog_delete_feature_flag', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('posthog_delete_dashboard', { project_id: projectId, id: dashboardId });
      steps.push(makeStep('delete dashboard', 'posthog_delete_dashboard', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke dashboard ${dashboardId}`, errorMessage(error));
      steps.push(makeStep('delete dashboard', 'posthog_delete_dashboard', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
