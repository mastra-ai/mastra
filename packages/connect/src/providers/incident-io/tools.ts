// AUTO-GENERATED from rhysbalevicius/integration-templates @ b5c56f19353e — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { addAlertTagsTool } from './tools/add-alert-tags.js';
import { connectFollowUpExternalIssueTool } from './tools/connect-follow-up-external-issue.js';
import { createActionTool } from './tools/create-action.js';
import { createFollowUpTool } from './tools/create-follow-up.js';
import { createIncidentAlertTool } from './tools/create-incident-alert.js';
import { createIncidentTimelineItemTool } from './tools/create-incident-timeline-item.js';
import { createIncidentUpdateTool } from './tools/create-incident-update.js';
import { createIncidentTool } from './tools/create-incident.js';
import { deleteActionTool } from './tools/delete-action.js';
import { deleteFollowUpTool } from './tools/delete-follow-up.js';
import { getActionTool } from './tools/get-action.js';
import { getAlertTool } from './tools/get-alert.js';
import { getCatalogEntryTool } from './tools/get-catalog-entry.js';
import { getCatalogTypeTool } from './tools/get-catalog-type.js';
import { getFollowUpTool } from './tools/get-follow-up.js';
import { getIncidentRoleTool } from './tools/get-incident-role.js';
import { getIncidentStatusTool } from './tools/get-incident-status.js';
import { getIncidentTimestampTool } from './tools/get-incident-timestamp.js';
import { getIncidentTypeTool } from './tools/get-incident-type.js';
import { getIncidentTool } from './tools/get-incident.js';
import { getPostmortemDocumentContentTool } from './tools/get-postmortem-document-content.js';
import { getPostmortemDocumentTool } from './tools/get-postmortem-document.js';
import { getScheduleOverrideTool } from './tools/get-schedule-override.js';
import { getScheduleReplicaTool } from './tools/get-schedule-replica.js';
import { getScheduleSyncRuleTool } from './tools/get-schedule-sync-rule.js';
import { getScheduleTool } from './tools/get-schedule.js';
import { getSeverityTool } from './tools/get-severity.js';
import { getTeamTool } from './tools/get-team.js';
import { getUserPagingProviderTool } from './tools/get-user-paging-provider.js';
import { getUserTool } from './tools/get-user.js';
import { listActionsTool } from './tools/list-actions.js';
import { listAlertTagsTool } from './tools/list-alert-tags.js';
import { listAlertsTool } from './tools/list-alerts.js';
import { listCatalogEntriesTool } from './tools/list-catalog-entries.js';
import { listCatalogResourcesTool } from './tools/list-catalog-resources.js';
import { listCatalogTypesTool } from './tools/list-catalog-types.js';
import { listFollowUpsTool } from './tools/list-follow-ups.js';
import { listIncidentAlertsTool } from './tools/list-incident-alerts.js';
import { listIncidentParticipantWorkloadsTool } from './tools/list-incident-participant-workloads.js';
import { listIncidentParticipantsTool } from './tools/list-incident-participants.js';
import { listIncidentRolesTool } from './tools/list-incident-roles.js';
import { listIncidentStatusesTool } from './tools/list-incident-statuses.js';
import { listIncidentTimelineItemsTool } from './tools/list-incident-timeline-items.js';
import { listIncidentTimestampsTool } from './tools/list-incident-timestamps.js';
import { listIncidentTypesTool } from './tools/list-incident-types.js';
import { listIncidentUpdatesTool } from './tools/list-incident-updates.js';
import { listIncidentsTool } from './tools/list-incidents.js';
import { listPostmortemDocumentsTool } from './tools/list-postmortem-documents.js';
import { listScheduleEntriesTool } from './tools/list-schedule-entries.js';
import { listScheduleOverridesTool } from './tools/list-schedule-overrides.js';
import { listScheduleReplicasTool } from './tools/list-schedule-replicas.js';
import { listScheduleSyncRulesTool } from './tools/list-schedule-sync-rules.js';
import { listSchedulesTool } from './tools/list-schedules.js';
import { listSeveritiesTool } from './tools/list-severities.js';
import { listTeamsTool } from './tools/list-teams.js';
import { listUserNotificationMethodsTool } from './tools/list-user-notification-methods.js';
import { listUserNotificationRulesTool } from './tools/list-user-notification-rules.js';
import { listUsersTool } from './tools/list-users.js';
import { removeAlertTagsTool } from './tools/remove-alert-tags.js';
import { resolveAlertTool } from './tools/resolve-alert.js';
import { setAlertTagsTool } from './tools/set-alert-tags.js';
import { transitionIncidentAlertTool } from './tools/transition-incident-alert.js';
import { updateActionTool } from './tools/update-action.js';
import { updateFollowUpTool } from './tools/update-follow-up.js';
import { updateIncidentTimelineItemTool } from './tools/update-incident-timeline-item.js';
import { updateIncidentTool } from './tools/update-incident.js';

export function createIncidentIoTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    incident_io_add_alert_tags: addAlertTagsTool(platformProxy),
    incident_io_connect_follow_up_external_issue: connectFollowUpExternalIssueTool(platformProxy),
    incident_io_create_action: createActionTool(platformProxy),
    incident_io_create_follow_up: createFollowUpTool(platformProxy),
    incident_io_create_incident_alert: createIncidentAlertTool(platformProxy),
    incident_io_create_incident_timeline_item: createIncidentTimelineItemTool(platformProxy),
    incident_io_create_incident_update: createIncidentUpdateTool(platformProxy),
    incident_io_create_incident: createIncidentTool(platformProxy),
    incident_io_delete_action: deleteActionTool(platformProxy),
    incident_io_delete_follow_up: deleteFollowUpTool(platformProxy),
    incident_io_get_action: getActionTool(platformProxy),
    incident_io_get_alert: getAlertTool(platformProxy),
    incident_io_get_catalog_entry: getCatalogEntryTool(platformProxy),
    incident_io_get_catalog_type: getCatalogTypeTool(platformProxy),
    incident_io_get_follow_up: getFollowUpTool(platformProxy),
    incident_io_get_incident_role: getIncidentRoleTool(platformProxy),
    incident_io_get_incident_status: getIncidentStatusTool(platformProxy),
    incident_io_get_incident_timestamp: getIncidentTimestampTool(platformProxy),
    incident_io_get_incident_type: getIncidentTypeTool(platformProxy),
    incident_io_get_incident: getIncidentTool(platformProxy),
    incident_io_get_postmortem_document_content: getPostmortemDocumentContentTool(platformProxy),
    incident_io_get_postmortem_document: getPostmortemDocumentTool(platformProxy),
    incident_io_get_schedule_override: getScheduleOverrideTool(platformProxy),
    incident_io_get_schedule_replica: getScheduleReplicaTool(platformProxy),
    incident_io_get_schedule_sync_rule: getScheduleSyncRuleTool(platformProxy),
    incident_io_get_schedule: getScheduleTool(platformProxy),
    incident_io_get_severity: getSeverityTool(platformProxy),
    incident_io_get_team: getTeamTool(platformProxy),
    incident_io_get_user_paging_provider: getUserPagingProviderTool(platformProxy),
    incident_io_get_user: getUserTool(platformProxy),
    incident_io_list_actions: listActionsTool(platformProxy),
    incident_io_list_alert_tags: listAlertTagsTool(platformProxy),
    incident_io_list_alerts: listAlertsTool(platformProxy),
    incident_io_list_catalog_entries: listCatalogEntriesTool(platformProxy),
    incident_io_list_catalog_resources: listCatalogResourcesTool(platformProxy),
    incident_io_list_catalog_types: listCatalogTypesTool(platformProxy),
    incident_io_list_follow_ups: listFollowUpsTool(platformProxy),
    incident_io_list_incident_alerts: listIncidentAlertsTool(platformProxy),
    incident_io_list_incident_participant_workloads: listIncidentParticipantWorkloadsTool(platformProxy),
    incident_io_list_incident_participants: listIncidentParticipantsTool(platformProxy),
    incident_io_list_incident_roles: listIncidentRolesTool(platformProxy),
    incident_io_list_incident_statuses: listIncidentStatusesTool(platformProxy),
    incident_io_list_incident_timeline_items: listIncidentTimelineItemsTool(platformProxy),
    incident_io_list_incident_timestamps: listIncidentTimestampsTool(platformProxy),
    incident_io_list_incident_types: listIncidentTypesTool(platformProxy),
    incident_io_list_incident_updates: listIncidentUpdatesTool(platformProxy),
    incident_io_list_incidents: listIncidentsTool(platformProxy),
    incident_io_list_postmortem_documents: listPostmortemDocumentsTool(platformProxy),
    incident_io_list_schedule_entries: listScheduleEntriesTool(platformProxy),
    incident_io_list_schedule_overrides: listScheduleOverridesTool(platformProxy),
    incident_io_list_schedule_replicas: listScheduleReplicasTool(platformProxy),
    incident_io_list_schedule_sync_rules: listScheduleSyncRulesTool(platformProxy),
    incident_io_list_schedules: listSchedulesTool(platformProxy),
    incident_io_list_severities: listSeveritiesTool(platformProxy),
    incident_io_list_teams: listTeamsTool(platformProxy),
    incident_io_list_user_notification_methods: listUserNotificationMethodsTool(platformProxy),
    incident_io_list_user_notification_rules: listUserNotificationRulesTool(platformProxy),
    incident_io_list_users: listUsersTool(platformProxy),
    incident_io_remove_alert_tags: removeAlertTagsTool(platformProxy),
    incident_io_resolve_alert: resolveAlertTool(platformProxy),
    incident_io_set_alert_tags: setAlertTagsTool(platformProxy),
    incident_io_transition_incident_alert: transitionIncidentAlertTool(platformProxy),
    incident_io_update_action: updateActionTool(platformProxy),
    incident_io_update_follow_up: updateFollowUpTool(platformProxy),
    incident_io_update_incident_timeline_item: updateIncidentTimelineItemTool(platformProxy),
    incident_io_update_incident: updateIncidentTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
