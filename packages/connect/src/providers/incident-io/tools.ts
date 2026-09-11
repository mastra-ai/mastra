// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { createFollowUpTool } from './tools/create-follow-up.js';
import { createIncidentTool } from './tools/create-incident.js';
import { getActionTool } from './tools/get-action.js';
import { getFollowUpTool } from './tools/get-follow-up.js';
import { getIncidentTool } from './tools/get-incident.js';
import { listActionsTool } from './tools/list-actions.js';
import { listFollowUpsTool } from './tools/list-follow-ups.js';
import { listIncidentStatusesTool } from './tools/list-incident-statuses.js';
import { listIncidentsTool } from './tools/list-incidents.js';
import { listSeveritiesTool } from './tools/list-severities.js';
import { updateFollowUpTool } from './tools/update-follow-up.js';

export function createIncidentIoTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    incident_io_create_follow_up: createFollowUpTool(platformProxy),
    incident_io_create_incident: createIncidentTool(platformProxy),
    incident_io_get_action: getActionTool(platformProxy),
    incident_io_get_follow_up: getFollowUpTool(platformProxy),
    incident_io_get_incident: getIncidentTool(platformProxy),
    incident_io_list_actions: listActionsTool(platformProxy),
    incident_io_list_follow_ups: listFollowUpsTool(platformProxy),
    incident_io_list_incident_statuses: listIncidentStatusesTool(platformProxy),
    incident_io_list_incidents: listIncidentsTool(platformProxy),
    incident_io_list_severities: listSeveritiesTool(platformProxy),
    incident_io_update_follow_up: updateFollowUpTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
