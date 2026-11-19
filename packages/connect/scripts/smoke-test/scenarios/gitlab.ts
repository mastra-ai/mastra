import { randomUUID } from 'node:crypto';
import type { Scenario, ScenarioStep } from '../scenario.js';
import { errorMessage, makeStep, probeTool, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep GitLab scenario. Everything project-scoped runs inside a disposable
 * private project the scenario creates (`<runId>`) and deletes at the end, so
 * no existing repository is touched:
 *
 *   project → issue → branch/file/commit → merge request → release → pipeline
 *
 * CI never consumes compute: the project starts empty, shared runners are
 * switched off before its first commit, every commit carries `[skip ci]`, and
 * the one pipeline the scenario creates pins its job to a runner tag nothing
 * serves, so the job sits `pending` until the pipeline is cancelled and deleted.
 * GitLab.com keeps the deleted project for its retention period.
 *
 * Groups: GitLab.com does not let most users create top-level groups through
 * the API. Set `MASTRA_SMOKE_GITLAB_PARENT_GROUP_ID` to a group the connection
 * can create subgroups in to run the real group lifecycle, including permanent
 * removal; otherwise the scenario tries a top-level group and, when GitLab
 * refuses, skips the create and probes the group write tools against a
 * synthetic id.
 */

const LEAK_SEARCH_MAX_PAGES = 5;
const LEAK_SEARCH_ATTEMPTS = 3;
const LEAK_SEARCH_INTERVAL_MS = 5_000;
const GROUP_REREAD_ATTEMPTS = 3;
const GROUP_REREAD_INTERVAL_MS = 5_000;
const CI_JOB_NAME = 'mastra-smoke';
/** Job states GitLab's retry endpoint accepts. */
const RETRYABLE_JOB_STATES = new Set(['failed', 'canceled', 'success']);

const GITLAB_TOOLS = [
  'gitlab_cancel_pipeline',
  'gitlab_create_branch',
  'gitlab_create_commit',
  'gitlab_create_file',
  'gitlab_create_group',
  'gitlab_create_issue',
  'gitlab_create_merge_request',
  'gitlab_create_pipeline',
  'gitlab_create_project',
  'gitlab_create_release',
  'gitlab_delete_branch',
  'gitlab_delete_file',
  'gitlab_delete_group',
  'gitlab_delete_issue',
  'gitlab_delete_merge_request',
  'gitlab_delete_pipeline',
  'gitlab_delete_project',
  'gitlab_delete_release',
  'gitlab_get_branch',
  'gitlab_get_commit',
  'gitlab_get_file',
  'gitlab_get_group',
  'gitlab_get_issue',
  'gitlab_get_job',
  'gitlab_get_merge_request',
  'gitlab_get_pipeline',
  'gitlab_get_project',
  'gitlab_get_release',
  'gitlab_list_branches',
  'gitlab_list_commits',
  'gitlab_list_groups',
  'gitlab_list_issues',
  'gitlab_list_jobs',
  'gitlab_list_merge_requests',
  'gitlab_list_pipelines',
  'gitlab_list_projects',
  'gitlab_list_releases',
  'gitlab_retry_job',
  'gitlab_update_file',
  'gitlab_update_group',
  'gitlab_update_issue',
  'gitlab_update_merge_request',
  'gitlab_update_project',
  'gitlab_update_release',
] as const;

export const gitlabScenario: Scenario = {
  integrationId: 'gitlab',
  summary: 'disposable project: issue, branch/file/commit, MR, release, pipeline/job, group CRUD',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, GITLAB_TOOLS);
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

    // A marker unique to this create attempt, so recovery never claims a
    // project that merely shares the run's path.
    const createMarker = randomUUID();
    // An empty project, so no commit exists until shared runners are off.
    const project = await step<{ id: number; default_branch?: string | null }>(
      'create project',
      'gitlab_create_project',
      {
        name: runId,
        path: runId,
        description: `Automated @mastra/connect smoke test ${createMarker}. Safe to delete.`,
        visibility: 'private',
      },
      out => `#${out.id}`,
    );
    const projectId = project?.id ?? (await findLeakedProject());
    if (projectId === undefined) return steps;
    const pid = String(projectId);

    try {
      if (project) await runProjectLifecycle(projectId, pid);
    } finally {
      try {
        await call('gitlab_delete_project', { project_id: pid });
        steps.push(
          makeStep(
            'delete project',
            'gitlab_delete_project',
            'pass',
            'deletion requested; GitLab.com keeps the project for its retention period before removing it',
          ),
        );
      } catch (error) {
        log.error(`gitlab: leaked project ${projectId} (${runId}); delete it manually`, errorMessage(error));
        steps.push(makeStep('delete project', 'gitlab_delete_project', 'fail', errorMessage(error)));
      }
    }
    return steps;

    /** When create_project failed after GitLab may have created the project, finds it so it can still be deleted. */
    async function findLeakedProject(): Promise<number | undefined> {
      try {
        // GitLab may still be creating the project, so retry from page one a few times.
        for (let attempt = 0; attempt < LEAK_SEARCH_ATTEMPTS; attempt++) {
          if (attempt > 0) await new Promise(resolve => setTimeout(resolve, LEAK_SEARCH_INTERVAL_MS));
          const found = await searchLeakedProject();
          if (found !== undefined) return found;
        }
        log.error(`gitlab: could not confirm whether a ${runId} project was created; check manually`);
        return undefined;
      } catch (error) {
        log.error(`gitlab: could not check for a leaked ${runId} project; check manually`, errorMessage(error));
        return undefined;
      }
    }

    /** One pass over the owned-project search; undefined when no page matched. */
    async function searchLeakedProject(): Promise<number | undefined> {
      // `search` matches substrings, so the run's project can be on a later page.
      let cursor: string | undefined;
      for (let page = 0; page < LEAK_SEARCH_MAX_PAGES; page++) {
        const found = await call<{
          items: Array<{ id: number; path: string; description?: string | null }>;
          next_cursor?: string;
        }>('gitlab_list_projects', { search: runId, owned: true, per_page: 100, ...(cursor && { cursor }) });
        const leaked = found.items.find(item => item.path === runId && item.description?.includes(createMarker));
        if (leaked) {
          log.warn(`gitlab: create_project failed but project ${leaked.id} (${runId}) exists; deleting it`);
          return leaked.id;
        }
        cursor = found.next_cursor;
        if (!cursor) return undefined;
      }
      return undefined;
    }

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
          // GitLab.com refuses API-created top-level groups (400/403). That
          // can't be told apart from a missing scope by status alone, so it is
          // a skip, never a pass; set a parent group for the real lifecycle.
          // With an explicit parent, any failure is real.
          if (parentId === undefined && /status=(400|403)/.test(msg)) {
            steps.push(
              makeStep(
                'create group',
                'gitlab_create_group',
                'skip',
                `GitLab refused a top-level group; set MASTRA_SMOKE_GITLAB_PARENT_GROUP_ID for the full lifecycle: ${msg.slice(0, 160)}`,
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
        // Probe the write tools with a random group path nobody can own. A
        // numeric id could belong to a real group the connection maintains.
        const absentGroup = `mastra-smoke-absent-${randomUUID()}`;
        if (existingGroupId !== undefined) {
          await step('get group', 'gitlab_get_group', { id: existingGroupId });
        } else {
          steps.push(await probeTool(call, tools, 'get group', 'gitlab_get_group', { id: absentGroup }));
        }
        steps.push(
          await probeTool(call, tools, 'update group', 'gitlab_update_group', {
            id: absentGroup,
            description: `${runId} probe`,
          }),
        );
        steps.push(await probeTool(call, tools, 'delete group', 'gitlab_delete_group', { group_id: absentGroup }));
        return;
      }

      await step<{ id: number }>('get group', 'gitlab_get_group', { id: group.id });
      await step('update group', 'gitlab_update_group', { id: group.id, description: `${runId} (updated)` });
      try {
        await call('gitlab_delete_group', { group_id: group.id });
      } catch (error) {
        log.error(`gitlab: leaked group ${group.full_path}; delete it manually`, errorMessage(error));
        steps.push(makeStep('delete group', 'gitlab_delete_group', 'fail', errorMessage(error)));
        return;
      }

      if (parentId === undefined) {
        // Only subgroups can be removed permanently; a top-level group stays
        // scheduled for the instance's retention period.
        steps.push(
          makeStep('delete group', 'gitlab_delete_group', 'pass', `${group.full_path} scheduled for deletion`),
        );
        return;
      }

      // Instances with delayed deletion mark the group and rename it, and
      // permanent removal needs the new path, so read it back. Gone already
      // means it was deleted outright.
      let markedPath: string | undefined;
      let lastError: unknown;
      for (let attempt = 0; attempt < GROUP_REREAD_ATTEMPTS && markedPath === undefined; attempt++) {
        if (attempt > 0) await new Promise(resolve => setTimeout(resolve, GROUP_REREAD_INTERVAL_MS));
        try {
          const marked = await call<{ full_path?: string }>('gitlab_get_group', { id: group.id });
          // Without the renamed path, permanent removal would be rejected; keep polling.
          if (marked.full_path) markedPath = marked.full_path;
          else lastError = new Error('gitlab_get_group returned no full_path');
        } catch (error) {
          if (/status=404/.test(errorMessage(error))) {
            // A 404 can also mean the connection lost read access while the group sits in retention.
            log.error(
              `gitlab: subgroup ${group.id} returned 404 after scheduling deletion; confirm it was removed`,
              errorMessage(error),
            );
            steps.push(
              makeStep('delete group', 'gitlab_delete_group', 'fail', 'scheduled; removal unverified (group read 404)'),
            );
            return;
          }
          lastError = error;
        }
      }
      if (markedPath === undefined) {
        // The pre-delete path would be rejected, leaving the subgroup in retention.
        log.error(
          `gitlab: subgroup ${group.id} is scheduled for deletion but its new path could not be read; remove it manually`,
          errorMessage(lastError),
        );
        steps.push(makeStep('delete group', 'gitlab_delete_group', 'fail', errorMessage(lastError)));
        return;
      }
      try {
        await call('gitlab_delete_group', { group_id: group.id, permanently_remove: true, full_path: markedPath });
        steps.push(
          makeStep('delete group', 'gitlab_delete_group', 'pass', 'scheduled, then permanent removal requested'),
        );
      } catch (error) {
        log.error(
          `gitlab: subgroup ${markedPath} is scheduled for deletion but was not removed; remove it manually`,
          errorMessage(error),
        );
        steps.push(makeStep('delete group', 'gitlab_delete_group', 'fail', errorMessage(error)));
      }
    }

    async function runProjectLifecycle(projectId: number, pid: string) {
      // Shared runners off before the first commit, so nothing the scenario
      // does can consume CI compute.
      await step('update project', 'gitlab_update_project', {
        id: projectId,
        description: `${runId} (updated)`,
        shared_runners_enabled: false,
      });

      const empty = await step<{ default_branch?: string | null; shared_runners_enabled?: boolean }>(
        'get project',
        'gitlab_get_project',
        { project_id: projectId },
      );
      if (empty?.shared_runners_enabled !== false) {
        // Without isolation, a commit could start CI on shared runners; stop before writing.
        log.error(`gitlab: shared runners not confirmed off on project ${projectId}; skipping repository writes`);
        steps.push(makeStep('isolate runners', 'gitlab_get_project', 'fail', 'shared_runners_enabled is not false'));
        return;
      }
      const defaultBranch = empty?.default_branch ?? 'main';
      const seeded = await step('create README', 'gitlab_create_file', {
        project_id: projectId,
        file_path: 'README.md',
        branch: defaultBranch,
        content: `# ${runId}\n\nAutomated @mastra/connect smoke test. Safe to delete.\n`,
        commit_message: `${runId} initial commit [skip ci]`,
      });
      if (!seeded) {
        steps.push(
          makeStep('seed repository', 'gitlab_create_file', 'fail', 'repository has no commits to branch from'),
        );
        return;
      }

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
        content: [`${CI_JOB_NAME}:`, `  tags: ["${runId}-no-such-runner"]`, '  script: ["true"]', ''].join('\n'),
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
      const jobs = await step<{ items: Array<{ id: number; name: string; pipeline?: { id: number } }> }>(
        'list jobs',
        'gitlab_list_jobs',
        { project_id: projectId, per_page: 20 },
        out => `${out.items.length} jobs`,
      );
      const jobId = jobs?.items.find(job => job.pipeline?.id === pipeline.id && job.name === CI_JOB_NAME)?.id;

      await step('cancel pipeline', 'gitlab_cancel_pipeline', { project_id: projectId, pipeline_id: pipeline.id });
      if (jobId === undefined) {
        steps.push(makeStep('get job', 'gitlab_get_job', 'fail', `pipeline #${pipeline.id} has no ${CI_JOB_NAME} job`));
        steps.push(makeStep('retry job', 'gitlab_retry_job', 'skip', 'no job to retry'));
      } else {
        const job = await step<{ status: string }>(
          'get job',
          'gitlab_get_job',
          { project_id: projectId, job_id: jobId },
          out => out.status,
        );
        if (job && RETRYABLE_JOB_STATES.has(job.status)) {
          // The retried copy is equally unrunnable; deleting the pipeline removes both.
          await step('retry job', 'gitlab_retry_job', { project_id: projectId, job_id: jobId });
        } else {
          steps.push(
            makeStep(
              'retry job',
              'gitlab_retry_job',
              'fail',
              job ? `job is ${job.status} after cancelling its pipeline; GitLab can't retry it` : 'job not read',
            ),
          );
        }
      }
      try {
        await call('gitlab_delete_pipeline', { project_id: pid, pipeline_id: pipeline.id });
        steps.push(makeStep('delete pipeline', 'gitlab_delete_pipeline', 'pass'));
      } catch (error) {
        // Deleting the project only schedules it, so the pipeline can outlive this run.
        log.error(
          `gitlab: leaked pipeline ${pipeline.id} in project ${projectId}; delete it manually`,
          errorMessage(error),
        );
        steps.push(makeStep('delete pipeline', 'gitlab_delete_pipeline', 'fail', errorMessage(error)));
      }
    }
  },
};
