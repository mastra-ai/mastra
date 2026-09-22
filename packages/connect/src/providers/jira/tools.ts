// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { addCommentTool } from './tools/add-comment.js';
import { addWorklogTool } from './tools/add-worklog.js';
import { createIssueLinkTool } from './tools/create-issue-link.js';
import { createIssueTool } from './tools/create-issue.js';
import { deleteAttachmentTool } from './tools/delete-attachment.js';
import { deleteCommentTool } from './tools/delete-comment.js';
import { deleteIssueLinkTool } from './tools/delete-issue-link.js';
import { deleteIssueTool } from './tools/delete-issue.js';
import { deleteWorklogTool } from './tools/delete-worklog.js';
import { getCreateIssueMetadataTool } from './tools/get-create-issue-metadata.js';
import { getEditIssueMetadataTool } from './tools/get-edit-issue-metadata.js';
import { getIssueChangelogTool } from './tools/get-issue-changelog.js';
import { getIssueTypeTool } from './tools/get-issue-type.js';
import { getIssueTool } from './tools/get-issue.js';
import { getMyselfTool } from './tools/get-myself.js';
import { getPriorityTool } from './tools/get-priority.js';
import { getProjectTool } from './tools/get-project.js';
import { getStatusTool } from './tools/get-status.js';
import { getUserTool } from './tools/get-user.js';
import { listFieldsTool } from './tools/list-fields.js';
import { listIssueCommentsTool } from './tools/list-issue-comments.js';
import { listIssueTypesTool } from './tools/list-issue-types.js';
import { listPrioritiesTool } from './tools/list-priorities.js';
import { listProjectComponentsTool } from './tools/list-project-components.js';
import { listProjectVersionsTool } from './tools/list-project-versions.js';
import { listProjectsTool } from './tools/list-projects.js';
import { listStatusesTool } from './tools/list-statuses.js';
import { listTransitionsTool } from './tools/list-transitions.js';
import { listUsersTool } from './tools/list-users.js';
import { listWatchersTool } from './tools/list-watchers.js';
import { listWorklogsTool } from './tools/list-worklogs.js';
import { removeWatcherTool } from './tools/remove-watcher.js';
import { searchIssuesTool } from './tools/search-issues.js';
import { transitionIssueTool } from './tools/transition-issue.js';
import { updateCommentTool } from './tools/update-comment.js';
import { updateIssueTool } from './tools/update-issue.js';
import { updateWorklogTool } from './tools/update-worklog.js';

export function createJiraTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    jira_add_comment: addCommentTool(platformProxy),
    jira_add_worklog: addWorklogTool(platformProxy),
    jira_create_issue_link: createIssueLinkTool(platformProxy),
    jira_create_issue: createIssueTool(platformProxy),
    jira_delete_attachment: deleteAttachmentTool(platformProxy),
    jira_delete_comment: deleteCommentTool(platformProxy),
    jira_delete_issue_link: deleteIssueLinkTool(platformProxy),
    jira_delete_issue: deleteIssueTool(platformProxy),
    jira_delete_worklog: deleteWorklogTool(platformProxy),
    jira_get_create_issue_metadata: getCreateIssueMetadataTool(platformProxy),
    jira_get_edit_issue_metadata: getEditIssueMetadataTool(platformProxy),
    jira_get_issue_changelog: getIssueChangelogTool(platformProxy),
    jira_get_issue_type: getIssueTypeTool(platformProxy),
    jira_get_issue: getIssueTool(platformProxy),
    jira_get_myself: getMyselfTool(platformProxy),
    jira_get_priority: getPriorityTool(platformProxy),
    jira_get_project: getProjectTool(platformProxy),
    jira_get_status: getStatusTool(platformProxy),
    jira_get_user: getUserTool(platformProxy),
    jira_list_fields: listFieldsTool(platformProxy),
    jira_list_issue_comments: listIssueCommentsTool(platformProxy),
    jira_list_issue_types: listIssueTypesTool(platformProxy),
    jira_list_priorities: listPrioritiesTool(platformProxy),
    jira_list_project_components: listProjectComponentsTool(platformProxy),
    jira_list_project_versions: listProjectVersionsTool(platformProxy),
    jira_list_projects: listProjectsTool(platformProxy),
    jira_list_statuses: listStatusesTool(platformProxy),
    jira_list_transitions: listTransitionsTool(platformProxy),
    jira_list_users: listUsersTool(platformProxy),
    jira_list_watchers: listWatchersTool(platformProxy),
    jira_list_worklogs: listWorklogsTool(platformProxy),
    jira_remove_watcher: removeWatcherTool(platformProxy),
    jira_search_issues: searchIssuesTool(platformProxy),
    jira_transition_issue: transitionIssueTool(platformProxy),
    jira_update_comment: updateCommentTool(platformProxy),
    jira_update_issue: updateIssueTool(platformProxy),
    jira_update_worklog: updateWorklogTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
