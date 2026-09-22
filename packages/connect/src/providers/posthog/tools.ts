// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { captureEventTool } from './tools/capture-event.js';
import { createActionTool } from './tools/create-action.js';
import { createAlertTool } from './tools/create-alert.js';
import { createAnnotationTool } from './tools/create-annotation.js';
import { createCohortTool } from './tools/create-cohort.js';
import { createDashboardTool } from './tools/create-dashboard.js';
import { createEarlyAccessFeatureTool } from './tools/create-early-access-feature.js';
import { createExperimentTool } from './tools/create-experiment.js';
import { createFeatureFlagTool } from './tools/create-feature-flag.js';
import { createInsightTool } from './tools/create-insight.js';
import { createPersonTool } from './tools/create-person.js';
import { createSurveyTool } from './tools/create-survey.js';
import { deleteActionTool } from './tools/delete-action.js';
import { deleteAlertTool } from './tools/delete-alert.js';
import { deleteAnnotationTool } from './tools/delete-annotation.js';
import { deleteCohortTool } from './tools/delete-cohort.js';
import { deleteDashboardTool } from './tools/delete-dashboard.js';
import { deleteEarlyAccessFeatureTool } from './tools/delete-early-access-feature.js';
import { deleteFeatureFlagTool } from './tools/delete-feature-flag.js';
import { deleteInsightTool } from './tools/delete-insight.js';
import { deletePersonTool } from './tools/delete-person.js';
import { deleteSurveyTool } from './tools/delete-survey.js';
import { getActionTool } from './tools/get-action.js';
import { getAlertTool } from './tools/get-alert.js';
import { getAnnotationTool } from './tools/get-annotation.js';
import { getCohortTool } from './tools/get-cohort.js';
import { getDashboardTool } from './tools/get-dashboard.js';
import { getEarlyAccessFeatureTool } from './tools/get-early-access-feature.js';
import { getEventDefinitionTool } from './tools/get-event-definition.js';
import { getEventTool } from './tools/get-event.js';
import { getExperimentTool } from './tools/get-experiment.js';
import { getFeatureFlagTool } from './tools/get-feature-flag.js';
import { getInsightTool } from './tools/get-insight.js';
import { getPersonTool } from './tools/get-person.js';
import { getProjectTool } from './tools/get-project.js';
import { getPropertyDefinitionTool } from './tools/get-property-definition.js';
import { getSurveyTool } from './tools/get-survey.js';
import { identifyPersonTool } from './tools/identify-person.js';
import { listActionsTool } from './tools/list-actions.js';
import { listAlertsTool } from './tools/list-alerts.js';
import { listAnnotationsTool } from './tools/list-annotations.js';
import { listCohortsTool } from './tools/list-cohorts.js';
import { listDashboardsTool } from './tools/list-dashboards.js';
import { listEarlyAccessFeaturesTool } from './tools/list-early-access-features.js';
import { listEventDefinitionsTool } from './tools/list-event-definitions.js';
import { listEventsTool } from './tools/list-events.js';
import { listExperimentsTool } from './tools/list-experiments.js';
import { listFeatureFlagsTool } from './tools/list-feature-flags.js';
import { listInsightsTool } from './tools/list-insights.js';
import { listPersonsTool } from './tools/list-persons.js';
import { listProjectsTool } from './tools/list-projects.js';
import { listPropertyDefinitionsTool } from './tools/list-property-definitions.js';
import { listSessionRecordingsTool } from './tools/list-session-recordings.js';
import { listSurveysTool } from './tools/list-surveys.js';
import { runQueryTool } from './tools/run-query.js';
import { updateActionTool } from './tools/update-action.js';
import { updateAlertTool } from './tools/update-alert.js';
import { updateAnnotationTool } from './tools/update-annotation.js';
import { updateCohortTool } from './tools/update-cohort.js';
import { updateDashboardTool } from './tools/update-dashboard.js';
import { updateEarlyAccessFeatureTool } from './tools/update-early-access-feature.js';
import { updateExperimentTool } from './tools/update-experiment.js';
import { updateFeatureFlagTool } from './tools/update-feature-flag.js';
import { updateInsightTool } from './tools/update-insight.js';
import { updatePersonTool } from './tools/update-person.js';
import { updatePropertyDefinitionTool } from './tools/update-property-definition.js';
import { updateSurveyTool } from './tools/update-survey.js';

export function createPosthogTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    posthog_capture_event: captureEventTool(platformProxy),
    posthog_create_action: createActionTool(platformProxy),
    posthog_create_alert: createAlertTool(platformProxy),
    posthog_create_annotation: createAnnotationTool(platformProxy),
    posthog_create_cohort: createCohortTool(platformProxy),
    posthog_create_dashboard: createDashboardTool(platformProxy),
    posthog_create_early_access_feature: createEarlyAccessFeatureTool(platformProxy),
    posthog_create_experiment: createExperimentTool(platformProxy),
    posthog_create_feature_flag: createFeatureFlagTool(platformProxy),
    posthog_create_insight: createInsightTool(platformProxy),
    posthog_create_person: createPersonTool(platformProxy),
    posthog_create_survey: createSurveyTool(platformProxy),
    posthog_delete_action: deleteActionTool(platformProxy),
    posthog_delete_alert: deleteAlertTool(platformProxy),
    posthog_delete_annotation: deleteAnnotationTool(platformProxy),
    posthog_delete_cohort: deleteCohortTool(platformProxy),
    posthog_delete_dashboard: deleteDashboardTool(platformProxy),
    posthog_delete_early_access_feature: deleteEarlyAccessFeatureTool(platformProxy),
    posthog_delete_feature_flag: deleteFeatureFlagTool(platformProxy),
    posthog_delete_insight: deleteInsightTool(platformProxy),
    posthog_delete_person: deletePersonTool(platformProxy),
    posthog_delete_survey: deleteSurveyTool(platformProxy),
    posthog_get_action: getActionTool(platformProxy),
    posthog_get_alert: getAlertTool(platformProxy),
    posthog_get_annotation: getAnnotationTool(platformProxy),
    posthog_get_cohort: getCohortTool(platformProxy),
    posthog_get_dashboard: getDashboardTool(platformProxy),
    posthog_get_early_access_feature: getEarlyAccessFeatureTool(platformProxy),
    posthog_get_event_definition: getEventDefinitionTool(platformProxy),
    posthog_get_event: getEventTool(platformProxy),
    posthog_get_experiment: getExperimentTool(platformProxy),
    posthog_get_feature_flag: getFeatureFlagTool(platformProxy),
    posthog_get_insight: getInsightTool(platformProxy),
    posthog_get_person: getPersonTool(platformProxy),
    posthog_get_project: getProjectTool(platformProxy),
    posthog_get_property_definition: getPropertyDefinitionTool(platformProxy),
    posthog_get_survey: getSurveyTool(platformProxy),
    posthog_identify_person: identifyPersonTool(platformProxy),
    posthog_list_actions: listActionsTool(platformProxy),
    posthog_list_alerts: listAlertsTool(platformProxy),
    posthog_list_annotations: listAnnotationsTool(platformProxy),
    posthog_list_cohorts: listCohortsTool(platformProxy),
    posthog_list_dashboards: listDashboardsTool(platformProxy),
    posthog_list_early_access_features: listEarlyAccessFeaturesTool(platformProxy),
    posthog_list_event_definitions: listEventDefinitionsTool(platformProxy),
    posthog_list_events: listEventsTool(platformProxy),
    posthog_list_experiments: listExperimentsTool(platformProxy),
    posthog_list_feature_flags: listFeatureFlagsTool(platformProxy),
    posthog_list_insights: listInsightsTool(platformProxy),
    posthog_list_persons: listPersonsTool(platformProxy),
    posthog_list_projects: listProjectsTool(platformProxy),
    posthog_list_property_definitions: listPropertyDefinitionsTool(platformProxy),
    posthog_list_session_recordings: listSessionRecordingsTool(platformProxy),
    posthog_list_surveys: listSurveysTool(platformProxy),
    posthog_run_query: runQueryTool(platformProxy),
    posthog_update_action: updateActionTool(platformProxy),
    posthog_update_alert: updateAlertTool(platformProxy),
    posthog_update_annotation: updateAnnotationTool(platformProxy),
    posthog_update_cohort: updateCohortTool(platformProxy),
    posthog_update_dashboard: updateDashboardTool(platformProxy),
    posthog_update_early_access_feature: updateEarlyAccessFeatureTool(platformProxy),
    posthog_update_experiment: updateExperimentTool(platformProxy),
    posthog_update_feature_flag: updateFeatureFlagTool(platformProxy),
    posthog_update_insight: updateInsightTool(platformProxy),
    posthog_update_person: updatePersonTool(platformProxy),
    posthog_update_property_definition: updatePropertyDefinitionTool(platformProxy),
    posthog_update_survey: updateSurveyTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
