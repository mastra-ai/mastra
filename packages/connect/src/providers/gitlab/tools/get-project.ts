// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';
import { withoutSecretFields } from '../../../runtime/redact.js';

/** Encodes one GitLab path segment exactly once, whether `value` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}

export const getProjectInputSchema = z.object({
  project_id: z
    .union([
      z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      z
        .string()
        .min(1)
        .refine(value => {
          try {
            encodeURIComponent(value);
            return true;
          } catch {
            return false;
          }
        }, 'must not contain unpaired surrogate characters'),
    ])
    .describe(
      'Numeric project ID, or the project path raw or URL-encoded. Example: 82599306, "team/app", or "team%2Fapp"',
    ),
});

const NamespaceSchema = z
  .object({
    id: z.number().nullish(),
    name: z.string().nullish(),
    path: z.string().nullish(),
    kind: z.string().nullish(),
    full_path: z.string().nullish(),
    parent_id: z.number().nullish(),
    avatar_url: z.string().nullish(),
    web_url: z.string().nullish(),
  })
  .passthrough();

const OwnerSchema = z
  .object({
    id: z.number().nullish(),
    name: z.string().nullish(),
    created_at: z.string().nullish(),
    username: z.string().nullish(),
    public_email: z.string().nullish(),
    state: z.string().nullish(),
    locked: z.boolean().nullish(),
    avatar_url: z.string().nullish(),
    web_url: z.string().nullish(),
  })
  .passthrough();

const ContainerExpirationPolicySchema = z
  .object({
    cadence: z.string().nullish(),
    enabled: z.boolean().nullish(),
    keep_n: z.number().nullish(),
    older_than: z.string().nullish(),
    name_regex: z.string().nullish(),
    name_regex_delete: z.string().nullish(),
    name_regex_keep: z.string().nullish(),
    next_run_at: z.string().nullish(),
  })
  .passthrough();

const PermissionsSchema = z
  .object({
    project_access: z
      .object({
        access_level: z.number().nullish(),
        notification_level: z.number().nullish(),
      })
      .passthrough()
      .nullish(),
    group_access: z
      .object({
        access_level: z.number().nullish(),
        notification_level: z.number().nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const LicenseSchema = z
  .object({
    key: z.string().nullish(),
    name: z.string().nullish(),
    nickname: z.string().nullish(),
    html_url: z.string().nullish(),
    source_url: z.string().nullish(),
  })
  .passthrough();

const StatisticsSchema = z
  .object({
    commit_count: z.number().nullish(),
    storage_size: z.number().nullish(),
    repository_size: z.number().nullish(),
    wiki_size: z.number().nullish(),
    lfs_objects_size: z.number().nullish(),
    job_artifacts_size: z.number().nullish(),
    pipeline_artifacts_size: z.number().nullish(),
    packages_size: z.number().nullish(),
    snippets_size: z.number().nullish(),
    uploads_size: z.number().nullish(),
    container_registry_size: z.number().nullish(),
  })
  .passthrough();

const SharedWithGroupSchema = z
  .object({
    group_id: z.number().nullish(),
    group_name: z.string().nullish(),
    group_full_path: z.string().nullish(),
    group_access_level: z.number().nullish(),
  })
  .passthrough();

const ForkedFromProjectSchema = z
  .object({
    id: z.number().nullish(),
    name: z.string().nullish(),
    path: z.string().nullish(),
    web_url: z.string().nullish(),
  })
  .passthrough();

export const getProjectOutputSchema = z
  .object({
    id: z.number(),
    description: z.string().nullish(),
    description_html: z.string().nullish(),
    name: z.string(),
    name_with_namespace: z.string().nullish(),
    path: z.string().nullish(),
    path_with_namespace: z.string().nullish(),
    created_at: z.string().nullish(),
    default_branch: z.string().nullish(),
    topics: z.array(z.string()).nullish(),
    ssh_url_to_repo: z.string().nullish(),
    http_url_to_repo: z.string().nullish(),
    web_url: z.string().nullish(),
    readme_url: z.string().nullish(),
    forks_count: z.number().nullish(),
    avatar_url: z.string().nullish(),
    star_count: z.number().nullish(),
    last_activity_at: z.string().nullish(),
    visibility: z.string().nullish(),
    namespace: NamespaceSchema.nullish(),
    owner: OwnerSchema.nullish(),
    container_registry_image_prefix: z.string().nullish(),
    _links: z.record(z.string(), z.string()).nullish(),
    marked_for_deletion_at: z.string().nullish(),
    marked_for_deletion_on: z.string().nullish(),
    packages_enabled: z.boolean().nullish(),
    empty_repo: z.boolean().nullish(),
    archived: z.boolean().nullish(),
    resolve_outdated_diff_discussions: z.boolean().nullish(),
    container_expiration_policy: ContainerExpirationPolicySchema.nullish(),
    issues_enabled: z.boolean().nullish(),
    merge_requests_enabled: z.boolean().nullish(),
    wiki_enabled: z.boolean().nullish(),
    jobs_enabled: z.boolean().nullish(),
    snippets_enabled: z.boolean().nullish(),
    container_registry_enabled: z.boolean().nullish(),
    service_desk_enabled: z.boolean().nullish(),
    service_desk_address: z.string().nullish(),
    can_create_merge_request_in: z.boolean().nullish(),
    issues_access_level: z.string().nullish(),
    repository_access_level: z.string().nullish(),
    merge_requests_access_level: z.string().nullish(),
    forking_access_level: z.string().nullish(),
    wiki_access_level: z.string().nullish(),
    builds_access_level: z.string().nullish(),
    snippets_access_level: z.string().nullish(),
    pages_access_level: z.string().nullish(),
    analytics_access_level: z.string().nullish(),
    container_registry_access_level: z.string().nullish(),
    security_and_compliance_access_level: z.string().nullish(),
    releases_access_level: z.string().nullish(),
    environments_access_level: z.string().nullish(),
    feature_flags_access_level: z.string().nullish(),
    infrastructure_access_level: z.string().nullish(),
    monitor_access_level: z.string().nullish(),
    model_experiments_access_level: z.string().nullish(),
    model_registry_access_level: z.string().nullish(),
    package_registry_access_level: z.string().nullish(),
    emails_disabled: z.boolean().nullish(),
    emails_enabled: z.boolean().nullish(),
    show_diff_preview_in_email: z.boolean().nullish(),
    shared_runners_enabled: z.boolean().nullish(),
    lfs_enabled: z.boolean().nullish(),
    creator_id: z.number().nullish(),
    import_url: z.string().nullish(),
    import_type: z.string().nullish(),
    import_status: z.string().nullish(),
    import_error: z.string().nullish(),
    open_issues_count: z.number().nullish(),
    updated_at: z.string().nullish(),
    ci_default_git_depth: z.number().nullish(),
    ci_forward_deployment_enabled: z.boolean().nullish(),
    ci_forward_deployment_rollback_allowed: z.boolean().nullish(),
    ci_job_token_scope_enabled: z.boolean().nullish(),
    ci_separated_caches: z.boolean().nullish(),
    ci_allow_fork_pipelines_to_run_in_parent_project: z.boolean().nullish(),
    ci_id_token_sub_claim_components: z.array(z.string()).nullish(),
    build_git_strategy: z.string().nullish(),
    keep_latest_artifact: z.boolean().nullish(),
    restrict_user_defined_variables: z.boolean().nullish(),
    ci_pipeline_variables_minimum_override_role: z.string().nullish(),
    runner_token_expiration_interval: z.number().nullish(),
    group_runners_enabled: z.boolean().nullish(),
    resource_group_default_process_mode: z.string().nullish(),
    auto_cancel_pending_pipelines: z.string().nullish(),
    build_timeout: z.number().nullish(),
    auto_devops_enabled: z.boolean().nullish(),
    auto_devops_deploy_strategy: z.string().nullish(),
    ci_push_repository_for_job_token_allowed: z.boolean().nullish(),
    runners_token: z.string().nullish(),
    ci_config_path: z.string().nullish(),
    public_jobs: z.boolean().nullish(),
    shared_with_groups: z.array(SharedWithGroupSchema).nullish(),
    only_allow_merge_if_pipeline_succeeds: z.boolean().nullish(),
    allow_merge_on_skipped_pipeline: z.boolean().nullish(),
    request_access_enabled: z.boolean().nullish(),
    only_allow_merge_if_all_discussions_are_resolved: z.boolean().nullish(),
    remove_source_branch_after_merge: z.boolean().nullish(),
    printing_merge_request_link_enabled: z.boolean().nullish(),
    printing_merge_requests_link_enabled: z.boolean().nullish(),
    merge_method: z.string().nullish(),
    merge_request_title_regex: z.string().nullish(),
    merge_request_title_regex_description: z.string().nullish(),
    squash_option: z.string().nullish(),
    enforce_auth_checks_on_uploads: z.boolean().nullish(),
    suggestion_commit_message: z.string().nullish(),
    merge_commit_template: z.string().nullish(),
    mr_default_title_template: z.string().nullish(),
    squash_commit_template: z.string().nullish(),
    issue_branch_template: z.string().nullish(),
    warn_about_potentially_unwanted_characters: z.boolean().nullish(),
    autoclose_referenced_issues: z.boolean().nullish(),
    max_artifacts_size: z.number().nullish(),
    approvals_before_merge: z.number().nullish(),
    mirror: z.boolean().nullish(),
    external_authorization_classification_label: z.string().nullish(),
    requirements_enabled: z.boolean().nullish(),
    requirements_access_level: z.string().nullish(),
    security_and_compliance_enabled: z.boolean().nullish(),
    secret_push_protection_enabled: z.boolean().nullish(),
    pre_receive_secret_detection_enabled: z.boolean().nullish(),
    compliance_frameworks: z.array(z.string()).nullish(),
    issues_template: z.string().nullish(),
    merge_requests_template: z.string().nullish(),
    ci_restrict_pipeline_cancellation_role: z.string().nullish(),
    merge_pipelines_enabled: z.boolean().nullish(),
    merge_trains_enabled: z.boolean().nullish(),
    merge_trains_skip_train_allowed: z.boolean().nullish(),
    max_pipelines_per_merge_train: z.number().nullish(),
    only_allow_merge_if_all_status_checks_passed: z.boolean().nullish(),
    allow_pipeline_trigger_approve_deployment: z.boolean().nullish(),
    prevent_merge_without_jira_issue: z.boolean().nullish(),
    duo_remote_flows_enabled: z.boolean().nullish(),
    duo_foundational_flows_enabled: z.boolean().nullish(),
    duo_sast_fp_detection_enabled: z.boolean().nullish(),
    duo_sast_vr_workflow_enabled: z.boolean().nullish(),
    web_based_commit_signing_enabled: z.boolean().nullish(),
    spp_repository_pipeline_access: z.boolean().nullish(),
    permissions: PermissionsSchema.nullish(),
    license_url: z.string().nullish(),
    license: LicenseSchema.nullish(),
    repository_storage: z.string().nullish(),
    mirror_user_id: z.number().nullish(),
    mirror_trigger_builds: z.boolean().nullish(),
    only_mirror_protected_branches: z.boolean().nullish(),
    mirror_overwrites_diverged_branches: z.boolean().nullish(),
    statistics: StatisticsSchema.nullish(),
    forked_from_project: ForkedFromProjectSchema.nullish(),
    mr_default_target_self: z.boolean().nullish(),
    tag_list: z.array(z.string()).nullish(),
  })
  .passthrough();

/** Provider secrets removed before the result leaves the tool. */
export const getProjectOutputSchemaRedacted = getProjectOutputSchema.omit({ runners_token: true });

export function getProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_get_project',
    description: 'Retrieve a single project from GitLab.',
    inputSchema: getProjectInputSchema,
    outputSchema: getProjectOutputSchemaRedacted,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getProjectOutputSchemaRedacted>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const result = await (async (): Promise<z.infer<typeof getProjectOutputSchema>> => {
        const config: PlatformProxyRequest = {
          // https://docs.gitlab.com/api/projects/#get-a-single-project
          endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}`,
          retries: 3,
        };

        const response = await platformProxy.get(config);

        if (!response.data) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: 'Project not found',
            project_id: input.project_id,
          });
        }

        const project = getProjectOutputSchema.parse(response.data);

        return project;
      })();
      return withoutSecretFields(result, ['runners_token']);
    },
  });
}
