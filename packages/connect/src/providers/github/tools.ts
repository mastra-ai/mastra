// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { addIssueCommentTool } from './tools/add-issue-comment.js';
import { createBranchTool } from './tools/create-branch.js';
import { createIssueTool } from './tools/create-issue.js';
import { createLabelTool } from './tools/create-label.js';
import { createOrUpdateFileTool } from './tools/create-or-update-file.js';
import { createPullRequestTool } from './tools/create-pull-request.js';
import { createReleaseTool } from './tools/create-release.js';
import { createReviewRequestTool } from './tools/create-review-request.js';
import { createTagObjectTool } from './tools/create-tag-object.js';
import { deleteFileTool } from './tools/delete-file.js';
import { deleteLabelTool } from './tools/delete-label.js';
import { deleteReleaseTool } from './tools/delete-release.js';
import { getBranchTool } from './tools/get-branch.js';
import { getCommitTool } from './tools/get-commit.js';
import { getFileContentsTool } from './tools/get-file-contents.js';
import { getIssueTool } from './tools/get-issue.js';
import { getLabelTool } from './tools/get-label.js';
import { getPullRequestTool } from './tools/get-pull-request.js';
import { getReleaseTool } from './tools/get-release.js';
import { getRepositoryTool } from './tools/get-repository.js';
import { getReviewTool } from './tools/get-review.js';
import { getTagRefTool } from './tools/get-tag-ref.js';
import { getTreeTool } from './tools/get-tree.js';
import { getWorkflowRunTool } from './tools/get-workflow-run.js';
import { getWorkflowTool } from './tools/get-workflow.js';
import { listBranchesTool } from './tools/list-branches.js';
import { listCommitsTool } from './tools/list-commits.js';
import { listIssueCommentsTool } from './tools/list-issue-comments.js';
import { listIssuesTool } from './tools/list-issues.js';
import { listLabelsTool } from './tools/list-labels.js';
import { listPullRequestFilesTool } from './tools/list-pull-request-files.js';
import { listPullRequestReviewsTool } from './tools/list-pull-request-reviews.js';
import { listPullRequestsTool } from './tools/list-pull-requests.js';
import { listReleaseAssetsTool } from './tools/list-release-assets.js';
import { listReleasesTool } from './tools/list-releases.js';
import { listTagsTool } from './tools/list-tags.js';
import { listWorkflowJobsTool } from './tools/list-workflow-jobs.js';
import { listWorkflowRunsTool } from './tools/list-workflow-runs.js';
import { listWorkflowsTool } from './tools/list-workflows.js';
import { mergePullRequestTool } from './tools/merge-pull-request.js';
import { rerunWorkflowRunTool } from './tools/rerun-workflow-run.js';
import { submitPullRequestReviewTool } from './tools/submit-pull-request-review.js';
import { updateIssueTool } from './tools/update-issue.js';
import { updateLabelTool } from './tools/update-label.js';
import { updatePullRequestTool } from './tools/update-pull-request.js';
import { updateReleaseTool } from './tools/update-release.js';

export function createGithubTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    github_add_issue_comment: addIssueCommentTool(platformProxy),
    github_create_branch: createBranchTool(platformProxy),
    github_create_issue: createIssueTool(platformProxy),
    github_create_label: createLabelTool(platformProxy),
    github_create_or_update_file: createOrUpdateFileTool(platformProxy),
    github_create_pull_request: createPullRequestTool(platformProxy),
    github_create_release: createReleaseTool(platformProxy),
    github_create_review_request: createReviewRequestTool(platformProxy),
    github_create_tag_object: createTagObjectTool(platformProxy),
    github_delete_file: deleteFileTool(platformProxy),
    github_delete_label: deleteLabelTool(platformProxy),
    github_delete_release: deleteReleaseTool(platformProxy),
    github_get_branch: getBranchTool(platformProxy),
    github_get_commit: getCommitTool(platformProxy),
    github_get_file_contents: getFileContentsTool(platformProxy),
    github_get_issue: getIssueTool(platformProxy),
    github_get_label: getLabelTool(platformProxy),
    github_get_pull_request: getPullRequestTool(platformProxy),
    github_get_release: getReleaseTool(platformProxy),
    github_get_repository: getRepositoryTool(platformProxy),
    github_get_review: getReviewTool(platformProxy),
    github_get_tag_ref: getTagRefTool(platformProxy),
    github_get_tree: getTreeTool(platformProxy),
    github_get_workflow_run: getWorkflowRunTool(platformProxy),
    github_get_workflow: getWorkflowTool(platformProxy),
    github_list_branches: listBranchesTool(platformProxy),
    github_list_commits: listCommitsTool(platformProxy),
    github_list_issue_comments: listIssueCommentsTool(platformProxy),
    github_list_issues: listIssuesTool(platformProxy),
    github_list_labels: listLabelsTool(platformProxy),
    github_list_pull_request_files: listPullRequestFilesTool(platformProxy),
    github_list_pull_request_reviews: listPullRequestReviewsTool(platformProxy),
    github_list_pull_requests: listPullRequestsTool(platformProxy),
    github_list_release_assets: listReleaseAssetsTool(platformProxy),
    github_list_releases: listReleasesTool(platformProxy),
    github_list_tags: listTagsTool(platformProxy),
    github_list_workflow_jobs: listWorkflowJobsTool(platformProxy),
    github_list_workflow_runs: listWorkflowRunsTool(platformProxy),
    github_list_workflows: listWorkflowsTool(platformProxy),
    github_merge_pull_request: mergePullRequestTool(platformProxy),
    github_rerun_workflow_run: rerunWorkflowRunTool(platformProxy),
    github_submit_pull_request_review: submitPullRequestReviewTool(platformProxy),
    github_update_issue: updateIssueTool(platformProxy),
    github_update_label: updateLabelTool(platformProxy),
    github_update_pull_request: updatePullRequestTool(platformProxy),
    github_update_release: updateReleaseTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
