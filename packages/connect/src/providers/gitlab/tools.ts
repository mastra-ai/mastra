// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { cancelPipelineTool } from './tools/cancel-pipeline.js';
import { createBranchTool } from './tools/create-branch.js';
import { createCommitTool } from './tools/create-commit.js';
import { createFileTool } from './tools/create-file.js';
import { createGroupTool } from './tools/create-group.js';
import { createIssueTool } from './tools/create-issue.js';
import { createMergeRequestTool } from './tools/create-merge-request.js';
import { createPipelineTool } from './tools/create-pipeline.js';
import { createProjectTool } from './tools/create-project.js';
import { createReleaseTool } from './tools/create-release.js';
import { deleteBranchTool } from './tools/delete-branch.js';
import { deleteFileTool } from './tools/delete-file.js';
import { deleteGroupTool } from './tools/delete-group.js';
import { deleteIssueTool } from './tools/delete-issue.js';
import { deleteMergeRequestTool } from './tools/delete-merge-request.js';
import { deletePipelineTool } from './tools/delete-pipeline.js';
import { deleteProjectTool } from './tools/delete-project.js';
import { deleteReleaseTool } from './tools/delete-release.js';
import { getBranchTool } from './tools/get-branch.js';
import { getCommitTool } from './tools/get-commit.js';
import { getFileTool } from './tools/get-file.js';
import { getGroupTool } from './tools/get-group.js';
import { getIssueTool } from './tools/get-issue.js';
import { getJobTool } from './tools/get-job.js';
import { getMergeRequestTool } from './tools/get-merge-request.js';
import { getPipelineTool } from './tools/get-pipeline.js';
import { getProjectTool } from './tools/get-project.js';
import { getReleaseTool } from './tools/get-release.js';
import { listBranchesTool } from './tools/list-branches.js';
import { listCommitsTool } from './tools/list-commits.js';
import { listGroupsTool } from './tools/list-groups.js';
import { listIssuesTool } from './tools/list-issues.js';
import { listJobsTool } from './tools/list-jobs.js';
import { listMergeRequestsTool } from './tools/list-merge-requests.js';
import { listPipelinesTool } from './tools/list-pipelines.js';
import { listProjectsTool } from './tools/list-projects.js';
import { listReleasesTool } from './tools/list-releases.js';
import { retryJobTool } from './tools/retry-job.js';
import { updateFileTool } from './tools/update-file.js';
import { updateGroupTool } from './tools/update-group.js';
import { updateIssueTool } from './tools/update-issue.js';
import { updateMergeRequestTool } from './tools/update-merge-request.js';
import { updateProjectTool } from './tools/update-project.js';
import { updateReleaseTool } from './tools/update-release.js';

export function createGitlabTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    gitlab_cancel_pipeline: cancelPipelineTool(platformProxy),
    gitlab_create_branch: createBranchTool(platformProxy),
    gitlab_create_commit: createCommitTool(platformProxy),
    gitlab_create_file: createFileTool(platformProxy),
    gitlab_create_group: createGroupTool(platformProxy),
    gitlab_create_issue: createIssueTool(platformProxy),
    gitlab_create_merge_request: createMergeRequestTool(platformProxy),
    gitlab_create_pipeline: createPipelineTool(platformProxy),
    gitlab_create_project: createProjectTool(platformProxy),
    gitlab_create_release: createReleaseTool(platformProxy),
    gitlab_delete_branch: deleteBranchTool(platformProxy),
    gitlab_delete_file: deleteFileTool(platformProxy),
    gitlab_delete_group: deleteGroupTool(platformProxy),
    gitlab_delete_issue: deleteIssueTool(platformProxy),
    gitlab_delete_merge_request: deleteMergeRequestTool(platformProxy),
    gitlab_delete_pipeline: deletePipelineTool(platformProxy),
    gitlab_delete_project: deleteProjectTool(platformProxy),
    gitlab_delete_release: deleteReleaseTool(platformProxy),
    gitlab_get_branch: getBranchTool(platformProxy),
    gitlab_get_commit: getCommitTool(platformProxy),
    gitlab_get_file: getFileTool(platformProxy),
    gitlab_get_group: getGroupTool(platformProxy),
    gitlab_get_issue: getIssueTool(platformProxy),
    gitlab_get_job: getJobTool(platformProxy),
    gitlab_get_merge_request: getMergeRequestTool(platformProxy),
    gitlab_get_pipeline: getPipelineTool(platformProxy),
    gitlab_get_project: getProjectTool(platformProxy),
    gitlab_get_release: getReleaseTool(platformProxy),
    gitlab_list_branches: listBranchesTool(platformProxy),
    gitlab_list_commits: listCommitsTool(platformProxy),
    gitlab_list_groups: listGroupsTool(platformProxy),
    gitlab_list_issues: listIssuesTool(platformProxy),
    gitlab_list_jobs: listJobsTool(platformProxy),
    gitlab_list_merge_requests: listMergeRequestsTool(platformProxy),
    gitlab_list_pipelines: listPipelinesTool(platformProxy),
    gitlab_list_projects: listProjectsTool(platformProxy),
    gitlab_list_releases: listReleasesTool(platformProxy),
    gitlab_retry_job: retryJobTool(platformProxy),
    gitlab_update_file: updateFileTool(platformProxy),
    gitlab_update_group: updateGroupTool(platformProxy),
    gitlab_update_issue: updateIssueTool(platformProxy),
    gitlab_update_merge_request: updateMergeRequestTool(platformProxy),
    gitlab_update_project: updateProjectTool(platformProxy),
    gitlab_update_release: updateReleaseTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
