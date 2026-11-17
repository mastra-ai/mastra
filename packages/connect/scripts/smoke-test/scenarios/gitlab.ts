import type { Scenario, ScenarioStep } from '../scenario.js';
import { errorMessage, makeStep, probeTool, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep GitLab scenario. Everything project-scoped runs inside a disposable
 * private project the scenario creates (`<runId>`) and deletes at the end, so
 * no existing repository is touched:
 *
 *   project → issue → branch/file/commit → merge request → release → pipeline
 *
 * CI never consumes compute: every commit carries `[skip ci]`, shared runners
 * are switched off on the project, and the one pipeline the scenario creates
 * pins its job to a runner tag nothing serves, so the job sits `pending` until
 * the pipeline is cancelled and deleted.
 *
 * Groups: GitLab.com does not let most users create top-level groups through
 * the API. Set `MASTRA_SMOKE_GITLAB_PARENT_GROUP_ID` to a group the connection
 * can create subgroups in to run the real group lifecycle; otherwise the
 * scenario tries a top-level group and, when GitLab refuses, probes the group
 * write tools against a synthetic id.
 */

const SYNTHETIC_GROUP_ID = 999_999_999;

export const gitlabScenario: Scenario = {
  integrationId: 'gitlab',
  summary: 'disposable project: issue, branch/file/commit, MR, release, pipeline/job, group CRUD',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['gitlab_create_project', 'gitlab_delete_project', 'gitlab_get_project']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    /** Runs one tool call as a step; returns the output, or undefined on failure/skip. */
    async function step<T>(name: string, toolId: string, input: unknown, detail?: (out: T) => string | undefined) {
      if (!tools[toolId]) {
        steps.push(makeStep(name, toolId, 'skip', 'tool not in project toolset'));
        return undefined;
      }
      try {
        const out = await call<T>(toolId, input);
        steps.push(makeStep(name, toolId, 'pass', detail?.(out)));
        return out;
      } catch (error) {
        steps.push(makeStep(name, toolId, 'fail', errorMessage(error)));
        return undefined;
      }
    }

    // GitLab user-groups reads need nothing created first.
    const groups = await step<{ items: Array<{ id: number }> }>(
      'list groups',
      'gitlab_list_groups',
      { per_page: 5 },
      out => `${out.items.length} groups`,
    );

    await runGroupLifecycle(groups?.items[0]?.id);

    const project = await step<{ id: number; default_branch?: string | null }>(
      'create project',
      'gitlab_create_project',
      {
        name: runId,
        path: runId,
        description: 'Automated @mastra/connect smoke test. Safe to delete.',
        visibility: 'private',
        initialize_with_readme: true,
      },
      out => `#${out.id}`,
    );
    if (!project) return steps;
    const projectId = project.id;
    const pid = String(projectId);

    try {
      await runProjectLifecycle(projectId, pid, project.default_branch ?? undefined);
    } finally {
      try {
        await call('gitlab_delete_project', { project_id: pid });
        steps.push(makeStep('delete project', 'gitlab_delete_project', 'pass'));
      } catch (error) {
        log.error(`gitlab: leaked project ${projectId} (${runId}); delete it manually`, errorMessage(error));
        steps.push(makeStep('delete project', 'gitlab_delete_project', 'fail', errorMessage(error)));
      }
    }
    return steps;

    async function runGroupLifecycle(existingGroupId: number | undefined) {
      const parentSpec = process.env.MASTRA_SMOKE_GITLAB_PARENT_GROUP_ID?.trim();
      const parentId = parentSpec ? Number(parentSpec) : undefined;
      if (parentSpec && !Number.isInteger(parentId)) {
        steps.push(
          makeStep(
            'create group',
            'gitlab_create_group',
            'fail',
            `Invalid MASTRA_SMOKE_GITLAB_PARENT_GROUP_ID="${parentSpec}"; expected a numeric group id.`,
          ),
        );
        return;
      }

      let group: { id: number; full_path: string } | undefined;
      if (tools['gitlab_create_group']) {
        try {
          group = await call<{ id: number; full_path: string }>('gitlab_create_group', {
            name: runId,
            path: runId,
            visibility: 'private',
            description: 'Automated @mastra/connect smoke test. Safe to delete.',
            ...(parentId !== undefined && { parent_id: parentId }),
          });
          steps.push(makeStep('create group', 'gitlab_create_group', 'pass', group.full_path));
        } catch (error) {
          const msg = errorMessage(error);
          // GitLab.com refuses API-created top-level groups (403/400). That is
          // a platform restriction, not a tool bug — the request still proved
          // routing and auth. With an explicit parent, any failure is real.
          if (parentId === undefined && /status=(400|403)/.test(msg)) {
            steps.push(
              makeStep(
                'create group',
                'gitlab_create_group',
                'pass',
                `top-level group creation refused (set MASTRA_SMOKE_GITLAB_PARENT_GROUP_ID for the full lifecycle): ${msg.slice(0, 120)}`,
              ),
            );
          } else {
            steps.push(makeStep('create group', 'gitlab_create_group', 'fail', msg));
          }
        }
      } else {
        steps.push(makeStep('create group', 'gitlab_create_group', 'skip', 'tool not in project toolset'));
      }

      if (!group) {
        if (existingGroupId !== undefined) {
          await step('get group', 'gitlab_get_group', { id: existingGroupId });
        } else {
          steps.push(await probeTool(call, tools, 'get group', 'gitlab_get_group', { id: SYNTHETIC_GROUP_ID }));
        }
        steps.push(
          await probeTool(call, tools, 'update group', 'gitlab_update_group', {
            id: SYNTHETIC_GROUP_ID,
            description: `${runId} probe`,
          }),
        );
        steps.push(
          await probeTool(call, tools, 'delete group', 'gitlab_delete_group', { group_id: SYNTHETIC_GROUP_ID }),
        );
        return;
      }

      await step<{ id: number }>('get group', 'gitlab_get_group', { id: group.id });
      await step('update group', 'gitlab_update_group', { id: group.id, description: `${runId} (updated)` });
      try {
        await call('gitlab_delete_group', { group_id: group.id });
        // GitLab.com marks groups for deletion first; a second call with
        // permanently_remove removes a marked subgroup immediately.
        try {
          await call('gitlab_delete_group', {
            group_id: group.id,
            permanently_remove: true,
            full_path: group.full_path,
          });
        } catch (error) {
          log.warn(`gitlab: group ${group.full_path} is marked for deletion but not yet removed`, errorMessage(error));
        }
        steps.push(makeStep('delete group', 'gitlab_delete_group', 'pass'));
      } catch (error) {
        log.error(`gitlab: leaked group ${group.full_path}; delete it manually`, errorMessage(error));
        steps.push(makeStep('delete group', 'gitlab_delete_group', 'fail', errorMessage(error)));
      }
    }

    async function runProjectLifecycle(projectId: number, pid: string, createdDefaultBranch: string | undefined) {
      const got = await step<{ default_branch?: string | null }>('get project', 'gitlab_get_project', {
        project_id: projectId,
      });
      const defaultBranch = got?.default_branch ?? createdDefaultBranch ?? 'main';

      // Shared runners off first, so nothing the scenario does can consume CI compute.
      await step('update project', 'gitlab_update_project', {
        id: projectId,
        description: `${runId} (updated)`,
        shared_runners_enabled: false,
      });

      steps.push(
        ...(await runReadBatch(
          call,
          [
            ['gitlab_list_projects', { search: runId, owned: true, per_page: 5 }],
            ['gitlab_list_branches', { project_id: projectId, per_page: 5 }],
            ['gitlab_list_issues', { project_id: projectId, per_page: 5 }],
            ['gitlab_list_merge_requests', { project_id: projectId, state: 'all' }],
            ['gitlab_list_releases', { project_id: pid, per_page: 5 }],
          ],
          tools,
        )),
      );

      // Issue lifecycle.
      const issue = await step<{ iid: number }>(
        'create issue',
        'gitlab_create_issue',
        { project_id: projectId, title: `${runId} smoke issue`, description: 'Safe to delete.' },
        out => `#${out.iid}`,
      );
      if (issue) {
        await step('get issue', 'gitlab_get_issue', { project_id: projectId, issue_iid: issue.iid });
        await step('update issue', 'gitlab_update_issue', {
          project_id: pid,
          issue_iid: issue.iid,
          title: `${runId} smoke issue (renamed)`,
          state_event: 'close',
        });
        await step('delete issue', 'gitlab_delete_issue', { project_id: projectId, issue_iid: issue.iid });
      }

      // Repository: branch, files, commits.
      const branch = `${runId}-branch`;
      const branchCreated = await step('create branch', 'gitlab_create_branch', {
        project_id: projectId,
        branch,
        ref: defaultBranch,
      });
      await step('get branch', 'gitlab_get_branch', { project_id: projectId, branch });

      const filePath = `${runId}.txt`;
      const fileCreated = await step('create file', 'gitlab_create_file', {
        project_id: projectId,
        file_path: filePath,
        branch,
        content: 'smoke v1\n',
        commit_message: `${runId} create file [skip ci]`,
      });
      await step<{ content: string }>('get file', 'gitlab_get_file', {
        project_id: projectId,
        file_path: filePath,
        ref: branch,
      });
      await step('update file', 'gitlab_update_file', {
        project_id: projectId,
        file_path: filePath,
        branch,
        content: 'smoke v2\n',
        commit_message: `${runId} update file [skip ci]`,
      });

      const commit = await step<{ id: string }>(
        'create commit',
        'gitlab_create_commit',
        {
          project_id: pid,
          branch,
          commit_message: `${runId} commit [skip ci]`,
          actions: [{ action: 'create', file_path: `${runId}-commit.txt`, content: 'from create_commit\n' }],
        },
        out => out.id.slice(0, 8),
      );
      if (commit) {
        await step('get commit', 'gitlab_get_commit', { project_id: projectId, sha: commit.id });
      }
      await step('list commits', 'gitlab_list_commits', { project_id: projectId, ref_name: branch, per_page: 5 });

      // Merge request from the smoke branch into the default branch.
      const mr = branchCreated
        ? await step<{ iid: number }>(
            'create merge request',
            'gitlab_create_merge_request',
            {
              project_id: projectId,
              source_branch: branch,
              target_branch: defaultBranch,
              title: `${runId} smoke MR`,
              description: 'Automated @mastra/connect smoke test. Safe to delete.',
            },
            out => `!${out.iid}`,
          )
        : undefined;
      if (mr) {
        await step('get merge request', 'gitlab_get_merge_request', {
          project_id: projectId,
          merge_request_iid: mr.iid,
        });
        await step('update merge request', 'gitlab_update_merge_request', {
          project_id: projectId,
          merge_request_iid: mr.iid,
          title: `${runId} smoke MR (renamed)`,
        });
        await step('delete merge request', 'gitlab_delete_merge_request', {
          project_id: projectId,
          merge_request_iid: mr.iid,
        });
      } else if (!branchCreated) {
        for (const id of [
          'gitlab_create_merge_request',
          'gitlab_get_merge_request',
          'gitlab_update_merge_request',
          'gitlab_delete_merge_request',
        ]) {
          steps.push(makeStep(id.replace('gitlab_', '').replace(/_/g, ' '), id, 'skip', 'smoke branch not created'));
        }
      }

      if (fileCreated) {
        await step('delete file', 'gitlab_delete_file', {
          project_id: projectId,
          file_path: filePath,
          branch,
          commit_message: `${runId} delete file [skip ci]`,
        });
      }
      if (branchCreated) {
        await step('delete branch', 'gitlab_delete_branch', { project_id: projectId, branch });
      }

      // Release (creates its tag from the default branch).
      const tagName = `${runId}-release`;
      const release = await step('create release', 'gitlab_create_release', {
        project_id: projectId,
        tag_name: tagName,
        ref: defaultBranch,
        name: `${runId} smoke release`,
        description: 'Automated @mastra/connect smoke test.',
      });
      if (release) {
        await step('get release', 'gitlab_get_release', { project_id: projectId, tag_name: tagName });
        await step('update release', 'gitlab_update_release', {
          project_id: pid,
          tag_name: tagName,
          description: 'Automated @mastra/connect smoke test (updated).',
        });
        await step('delete release', 'gitlab_delete_release', { project_id: pid, tag_name: tagName });
      }

      await runPipelineLifecycle(projectId, pid, defaultBranch);
    }

    async function runPipelineLifecycle(projectId: number, pid: string, defaultBranch: string) {
      // The job is pinned to a runner tag nothing serves (and shared runners
      // are off), so it can never start: zero CI compute.
      const ciCommitted = await step('commit CI config', 'gitlab_create_file', {
        project_id: projectId,
        file_path: '.gitlab-ci.yml',
        branch: defaultBranch,
        content: ['mastra-smoke:', `  tags: ["${runId}-no-such-runner"]`, '  script: ["true"]', ''].join('\n'),
        commit_message: `${runId} ci config [skip ci]`,
      });
      const pipeline = ciCommitted
        ? await step<{ id: number }>(
            'create pipeline',
            'gitlab_create_pipeline',
            { project_id: projectId, ref: defaultBranch },
            out => `#${out.id}`,
          )
        : undefined;
      if (!pipeline) {
        for (const id of [
          'gitlab_get_pipeline',
          'gitlab_list_pipelines',
          'gitlab_list_jobs',
          'gitlab_get_job',
          'gitlab_cancel_pipeline',
          'gitlab_retry_job',
          'gitlab_delete_pipeline',
        ]) {
          steps.push(makeStep(id.replace('gitlab_', '').replace(/_/g, ' '), id, 'skip', 'smoke pipeline not created'));
        }
        return;
      }

      await step('get pipeline', 'gitlab_get_pipeline', { project_id: projectId, pipeline_id: pipeline.id });
      await step('list pipelines', 'gitlab_list_pipelines', { project_id: projectId, per_page: 5 });
      const jobs = await step<{ items: Array<{ id: number }> }>(
        'list jobs',
        'gitlab_list_jobs',
        { project_id: projectId, per_page: 5 },
        out => `${out.items.length} jobs`,
      );
      const jobId = jobs?.items[0]?.id;
      if (jobId !== undefined) {
        await step('get job', 'gitlab_get_job', { project_id: projectId, job_id: jobId });
      } else {
        steps.push(makeStep('get job', 'gitlab_get_job', 'fail', 'smoke pipeline has no jobs'));
      }

      await step('cancel pipeline', 'gitlab_cancel_pipeline', { project_id: projectId, pipeline_id: pipeline.id });
      if (jobId !== undefined) {
        // Retrying the cancelled job queues a fresh copy that is equally
        // unrunnable; deleting the pipeline removes both.
        await step('retry job', 'gitlab_retry_job', { project_id: projectId, job_id: jobId });
      } else {
        steps.push(makeStep('retry job', 'gitlab_retry_job', 'skip', 'no job to retry'));
      }
      await step('delete pipeline', 'gitlab_delete_pipeline', { project_id: pid, pipeline_id: pipeline.id });
    }
  },
};
