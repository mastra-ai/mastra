// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { addIssueLabelTool } from './tools/add-issue-label.js';
import { archiveCycleTool } from './tools/archive-cycle.js';
import { archiveIssueTool } from './tools/archive-issue.js';
import { createAttachmentTool } from './tools/create-attachment.js';
import { createCommentTool } from './tools/create-comment.js';
import { createCycleTool } from './tools/create-cycle.js';
import { createIssueLabelTool } from './tools/create-issue-label.js';
import { createIssueRelationTool } from './tools/create-issue-relation.js';
import { createIssueTool } from './tools/create-issue.js';
import { createProjectTool } from './tools/create-project.js';
import { deleteAttachmentTool } from './tools/delete-attachment.js';
import { deleteCommentTool } from './tools/delete-comment.js';
import { deleteIssueLabelTool } from './tools/delete-issue-label.js';
import { deleteIssueRelationTool } from './tools/delete-issue-relation.js';
import { deleteIssueTool } from './tools/delete-issue.js';
import { getAttachmentTool } from './tools/get-attachment.js';
import { getCommentTool } from './tools/get-comment.js';
import { getCycleTool } from './tools/get-cycle.js';
import { getIssueLabelTool } from './tools/get-issue-label.js';
import { getIssueTool } from './tools/get-issue.js';
import { getProjectTool } from './tools/get-project.js';
import { getTeamTool } from './tools/get-team.js';
import { getUserTool } from './tools/get-user.js';
import { getViewerTool } from './tools/get-viewer.js';
import { getWorkflowStateTool } from './tools/get-workflow-state.js';
import { listAttachmentsTool } from './tools/list-attachments.js';
import { listCommentsTool } from './tools/list-comments.js';
import { listCyclesTool } from './tools/list-cycles.js';
import { listIssueLabelsTool } from './tools/list-issue-labels.js';
import { listIssuesTool } from './tools/list-issues.js';
import { listProjectsTool } from './tools/list-projects.js';
import { listTeamsTool } from './tools/list-teams.js';
import { listUsersTool } from './tools/list-users.js';
import { listWorkflowStatesTool } from './tools/list-workflow-states.js';
import { removeIssueLabelTool } from './tools/remove-issue-label.js';
import { resolveCommentTool } from './tools/resolve-comment.js';
import { searchIssuesTool } from './tools/search-issues.js';
import { unarchiveIssueTool } from './tools/unarchive-issue.js';
import { unarchiveProjectTool } from './tools/unarchive-project.js';
import { unresolveCommentTool } from './tools/unresolve-comment.js';
import { updateCommentTool } from './tools/update-comment.js';
import { updateCycleTool } from './tools/update-cycle.js';
import { updateIssueLabelTool } from './tools/update-issue-label.js';
import { updateIssueRelationTool } from './tools/update-issue-relation.js';
import { updateIssueTool } from './tools/update-issue.js';
import { updateProjectTool } from './tools/update-project.js';

export function createLinearTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    linear_add_issue_label: addIssueLabelTool(platformProxy),
    linear_archive_cycle: archiveCycleTool(platformProxy),
    linear_archive_issue: archiveIssueTool(platformProxy),
    linear_create_attachment: createAttachmentTool(platformProxy),
    linear_create_comment: createCommentTool(platformProxy),
    linear_create_cycle: createCycleTool(platformProxy),
    linear_create_issue_label: createIssueLabelTool(platformProxy),
    linear_create_issue_relation: createIssueRelationTool(platformProxy),
    linear_create_issue: createIssueTool(platformProxy),
    linear_create_project: createProjectTool(platformProxy),
    linear_delete_attachment: deleteAttachmentTool(platformProxy),
    linear_delete_comment: deleteCommentTool(platformProxy),
    linear_delete_issue_label: deleteIssueLabelTool(platformProxy),
    linear_delete_issue_relation: deleteIssueRelationTool(platformProxy),
    linear_delete_issue: deleteIssueTool(platformProxy),
    linear_get_attachment: getAttachmentTool(platformProxy),
    linear_get_comment: getCommentTool(platformProxy),
    linear_get_cycle: getCycleTool(platformProxy),
    linear_get_issue_label: getIssueLabelTool(platformProxy),
    linear_get_issue: getIssueTool(platformProxy),
    linear_get_project: getProjectTool(platformProxy),
    linear_get_team: getTeamTool(platformProxy),
    linear_get_user: getUserTool(platformProxy),
    linear_get_viewer: getViewerTool(platformProxy),
    linear_get_workflow_state: getWorkflowStateTool(platformProxy),
    linear_list_attachments: listAttachmentsTool(platformProxy),
    linear_list_comments: listCommentsTool(platformProxy),
    linear_list_cycles: listCyclesTool(platformProxy),
    linear_list_issue_labels: listIssueLabelsTool(platformProxy),
    linear_list_issues: listIssuesTool(platformProxy),
    linear_list_projects: listProjectsTool(platformProxy),
    linear_list_teams: listTeamsTool(platformProxy),
    linear_list_users: listUsersTool(platformProxy),
    linear_list_workflow_states: listWorkflowStatesTool(platformProxy),
    linear_remove_issue_label: removeIssueLabelTool(platformProxy),
    linear_resolve_comment: resolveCommentTool(platformProxy),
    linear_search_issues: searchIssuesTool(platformProxy),
    linear_unarchive_issue: unarchiveIssueTool(platformProxy),
    linear_unarchive_project: unarchiveProjectTool(platformProxy),
    linear_unresolve_comment: unresolveCommentTool(platformProxy),
    linear_update_comment: updateCommentTool(platformProxy),
    linear_update_cycle: updateCycleTool(platformProxy),
    linear_update_issue_label: updateIssueLabelTool(platformProxy),
    linear_update_issue_relation: updateIssueRelationTool(platformProxy),
    linear_update_issue: updateIssueTool(platformProxy),
    linear_update_project: updateProjectTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
