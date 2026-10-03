import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep GitHub scenario: issue + comment + label lifecycle inside a target
 * repo. Nango/mastra-connect expose no `list_repositories` tool, so the
 * scenario needs to be pointed at an existing repo the authenticated token
 * can write to. Set `MASTRA_SMOKE_GITHUB_REPO=owner/repo`; the scenario
 * resolves it with `github_get_repository` and skips cleanly when unset.
 */
export const githubScenario: Scenario = {
  integrationId: 'github',
  summary: 'issue + comment + label CRUD + repo reads',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'github_get_repository',
      'github_create_issue',
      'github_get_issue',
      'github_update_issue',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const targetSpec = process.env.MASTRA_SMOKE_GITHUB_REPO?.trim();
    if (!targetSpec) {
      steps.push(
        makeStep(
          'pick repo',
          'github_get_repository',
          'skip',
          'Set MASTRA_SMOKE_GITHUB_REPO=owner/repo to run the GitHub scenario (no list_repositories tool exists).',
        ),
      );
      return steps;
    }
    const slashIndex = targetSpec.indexOf('/');
    if (slashIndex <= 0 || slashIndex === targetSpec.length - 1) {
      steps.push(
        makeStep(
          'pick repo',
          'github_get_repository',
          'skip',
          `Invalid MASTRA_SMOKE_GITHUB_REPO="${targetSpec}"; expected "owner/repo".`,
        ),
      );
      return steps;
    }
    const owner = targetSpec.slice(0, slashIndex);
    const repo = targetSpec.slice(slashIndex + 1);

    try {
      await call('github_get_repository', { owner, repo });
    } catch (error) {
      steps.push(makeStep('pick repo', 'github_get_repository', 'fail', errorMessage(error)));
      return steps;
    }
    steps.push(makeStep('pick repo', 'github_get_repository', 'pass', `${owner}/${repo}`));

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['github_list_issues', { owner, repo, per_page: 5 }],
          ['github_list_labels', { owner, repo, per_page: 5 }],
          ['github_list_pull_requests', { owner, repo, per_page: 5, state: 'all' }],
          ['github_list_workflows', { owner, repo, per_page: 5 }],
          ['github_list_releases', { owner, repo, per_page: 5 }],
          ['github_list_branches', { owner, repo, per_page: 5 }],
          ['github_list_commits', { owner, repo, per_page: 5 }],
          ['github_list_tags', { owner, repo, per_page: 5 }],
        ],
        tools,
      )),
    );

    const title = `${runId} smoke issue`;
    let issueNumber: number | undefined;
    try {
      const issue = await call<{ number: number }>('github_create_issue', {
        owner,
        repo,
        title,
        body: 'Automated @mastra/connect smoke test. Safe to close.',
      });
      issueNumber = issue.number;
      steps.push(makeStep('create issue', 'github_create_issue', 'pass', `#${issueNumber}`));
    } catch (error) {
      steps.push(makeStep('create issue', 'github_create_issue', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      const got = await call<{ number: number; title?: string }>('github_get_issue', {
        owner,
        repo,
        issue_number: issueNumber,
      });
      const ok = got.title === title;
      steps.push(makeStep('read issue', 'github_get_issue', ok ? 'pass' : 'fail'));
    } catch (error) {
      steps.push(makeStep('read issue', 'github_get_issue', 'fail', errorMessage(error)));
    }

    try {
      await call('github_update_issue', {
        owner,
        repo,
        issue_number: issueNumber,
        title: `${title} (renamed)`,
      });
      steps.push(makeStep('update issue title', 'github_update_issue', 'pass'));
    } catch (error) {
      steps.push(makeStep('update issue title', 'github_update_issue', 'fail', errorMessage(error)));
    }

    if (tools['github_add_issue_comment']) {
      try {
        await call('github_add_issue_comment', {
          owner,
          repo,
          issue_number: issueNumber,
          body: `${runId} smoke comment (add variant)`,
        });
        steps.push(makeStep('add issue comment', 'github_add_issue_comment', 'pass'));
      } catch (error) {
        steps.push(makeStep('add issue comment', 'github_add_issue_comment', 'fail', errorMessage(error)));
      }
    }
    if (tools['github_list_issue_comments']) {
      try {
        await call('github_list_issue_comments', { owner, repo, issue_number: issueNumber, per_page: 5 });
        steps.push(makeStep('list issue comments', 'github_list_issue_comments', 'pass'));
      } catch (error) {
        steps.push(makeStep('list issue comments', 'github_list_issue_comments', 'fail', errorMessage(error)));
      }
    }

    // Repository + commit + tree + branch getters (default branch).
    let defaultBranch: string | undefined;
    let defaultSha: string | undefined;
    if (tools['github_get_repository']) {
      try {
        const r = await call<{ default_branch?: string }>('github_get_repository', { owner, repo });
        defaultBranch = r.default_branch;
        steps.push(makeStep('get repository', 'github_get_repository', 'pass', defaultBranch));
      } catch (error) {
        steps.push(makeStep('get repository', 'github_get_repository', 'fail', errorMessage(error)));
      }
    }
    if (defaultBranch && tools['github_get_branch']) {
      try {
        // github_get_branch flattens the GitHub REST shape; the sha lives on
        // the top-level `commit_sha` field, not nested under `commit.sha`.
        const b = await call<{ commit_sha?: string }>('github_get_branch', {
          owner,
          repo,
          branch: defaultBranch,
        });
        defaultSha = b.commit_sha;
        steps.push(makeStep('get branch', 'github_get_branch', 'pass', defaultSha?.slice(0, 7)));
      } catch (error) {
        steps.push(makeStep('get branch', 'github_get_branch', 'fail', errorMessage(error)));
      }
    }
    if (defaultSha && tools['github_get_commit']) {
      try {
        await call('github_get_commit', { owner, repo, ref: defaultSha });
        steps.push(makeStep('get commit', 'github_get_commit', 'pass'));
      } catch (error) {
        steps.push(makeStep('get commit', 'github_get_commit', 'fail', errorMessage(error)));
      }
    }
    if (defaultSha && tools['github_get_tree']) {
      try {
        await call('github_get_tree', { owner, repo, tree_sha: defaultSha });
        steps.push(makeStep('get tree', 'github_get_tree', 'pass'));
      } catch (error) {
        steps.push(makeStep('get tree', 'github_get_tree', 'fail', errorMessage(error)));
      }
    }

    // Branch + file + PR lifecycle: create branch from default sha, add a
    // file on it, open a PR, review + merge/close, then clean up.
    const smokeBranch = `smoke/${runId}`;
    const smokeFile = `.mastra-smoke/${runId}.md`;
    // github_create_or_update_file documents that it base64-encodes content
    // automatically; passing raw text is correct, pre-encoding double-wraps it.
    const smokeContent = `mastra smoke test ${runId}\n`;
    let branchCreated = false;
    if (defaultSha && tools['github_create_branch']) {
      try {
        await call('github_create_branch', { owner, repo, branch: smokeBranch, sha: defaultSha });
        branchCreated = true;
        steps.push(makeStep('create branch', 'github_create_branch', 'pass', smokeBranch));
      } catch (error) {
        steps.push(makeStep('create branch', 'github_create_branch', 'fail', errorMessage(error)));
      }
    }
    let fileSha: string | undefined;
    if (branchCreated && tools['github_create_or_update_file']) {
      try {
        const result = await call<{ content?: { sha?: string } }>('github_create_or_update_file', {
          owner,
          repo,
          path: smokeFile,
          message: `smoke: add ${smokeFile}`,
          content: smokeContent,
          branch: smokeBranch,
        });
        fileSha = result.content?.sha;
        steps.push(makeStep('create file on branch', 'github_create_or_update_file', 'pass', fileSha?.slice(0, 7)));
      } catch (error) {
        steps.push(makeStep('create file on branch', 'github_create_or_update_file', 'fail', errorMessage(error)));
      }
    }
    if (branchCreated && tools['github_get_file_contents']) {
      try {
        await call('github_get_file_contents', { owner, repo, path: smokeFile, ref: smokeBranch });
        steps.push(makeStep('get file contents', 'github_get_file_contents', 'pass'));
      } catch (error) {
        steps.push(makeStep('get file contents', 'github_get_file_contents', 'fail', errorMessage(error)));
      }
    }

    let prNumber: number | undefined;
    if (branchCreated && defaultBranch && tools['github_create_pull_request']) {
      try {
        const pr = await call<{ number: number }>('github_create_pull_request', {
          owner,
          repo,
          title: `${runId} smoke pr`,
          head: smokeBranch,
          base: defaultBranch,
          body: 'Automated @mastra/connect smoke PR. Safe to close.',
          draft: true,
        });
        prNumber = pr.number;
        steps.push(makeStep('create pull request', 'github_create_pull_request', 'pass', `#${prNumber}`));
      } catch (error) {
        steps.push(makeStep('create pull request', 'github_create_pull_request', 'fail', errorMessage(error)));
      }
    }
    if (prNumber && tools['github_get_pull_request']) {
      try {
        await call('github_get_pull_request', { owner, repo, pull_number: prNumber });
        steps.push(makeStep('get pull request', 'github_get_pull_request', 'pass'));
      } catch (error) {
        steps.push(makeStep('get pull request', 'github_get_pull_request', 'fail', errorMessage(error)));
      }
    }
    if (prNumber && tools['github_update_pull_request']) {
      try {
        await call('github_update_pull_request', {
          owner,
          repo,
          pull_number: prNumber,
          title: `${runId} smoke pr (edit)`,
        });
        steps.push(makeStep('update pull request', 'github_update_pull_request', 'pass'));
      } catch (error) {
        steps.push(makeStep('update pull request', 'github_update_pull_request', 'fail', errorMessage(error)));
      }
    }
    if (prNumber && tools['github_list_pull_request_files']) {
      try {
        await call('github_list_pull_request_files', { owner, repo, pull_number: prNumber, per_page: 5 });
        steps.push(makeStep('list pr files', 'github_list_pull_request_files', 'pass'));
      } catch (error) {
        steps.push(makeStep('list pr files', 'github_list_pull_request_files', 'fail', errorMessage(error)));
      }
    }
    if (prNumber && tools['github_list_pull_request_reviews']) {
      try {
        await call('github_list_pull_request_reviews', { owner, repo, pull_number: prNumber, per_page: 5 });
        steps.push(makeStep('list pr reviews', 'github_list_pull_request_reviews', 'pass'));
      } catch (error) {
        steps.push(makeStep('list pr reviews', 'github_list_pull_request_reviews', 'fail', errorMessage(error)));
      }
    }
    // GitHub rejects a PR author reviewing their own PR; probe accepts the
    // 422. For get_review + create_review_request we don't have a target
    // reviewer, so probe with synthetic ids/usernames.
    if (prNumber && tools['github_submit_pull_request_review']) {
      steps.push(
        await probeTool(call, tools, 'submit pr review (probe)', 'github_submit_pull_request_review', {
          owner,
          repo,
          pull_number: prNumber,
          event: 'COMMENT',
          body: `${runId} smoke review`,
        }),
      );
    }
    if (prNumber && tools['github_get_review']) {
      steps.push(
        await probeTool(call, tools, 'get pr review (probe)', 'github_get_review', {
          owner,
          repo,
          pull_number: prNumber,
          review_id: 1,
        }),
      );
    }
    if (prNumber && tools['github_create_review_request']) {
      steps.push(
        await probeTool(call, tools, 'create review request (probe)', 'github_create_review_request', {
          owner,
          repo,
          pull_number: prNumber,
          reviewers: ['mastra-smoke-nonexistent'],
        }),
      );
    }
    // merge_pull_request fails on a draft PR; probe accepts the expected
    // 405/422 as proof the endpoint wires correctly.
    if (prNumber && tools['github_merge_pull_request']) {
      steps.push(
        await probeTool(
          call,
          tools,
          'merge pull request (probe)',
          'github_merge_pull_request',
          {
            owner,
            repo,
            pull_number: prNumber,
            merge_method: 'squash',
          },
          // GitHub returns 405 "Method Not Allowed" when a draft PR can't be
          // merged — exactly the outcome we want for a smoke test that must
          // never actually land changes on main.
          /status=(400|401|403|404|405|409|422)|not found|does not exist|unauthoriz|forbidden|invalid|unknown/i,
        ),
      );
    }
    // Close PR + delete smoke file + delete branch for cleanup.
    if (prNumber && tools['github_update_pull_request']) {
      try {
        await call('github_update_pull_request', { owner, repo, pull_number: prNumber, state: 'closed' });
        steps.push(makeStep('close pull request', 'github_update_pull_request', 'pass'));
      } catch (error) {
        log.error(`Failed to close smoke PR #${prNumber}`, errorMessage(error));
        steps.push(makeStep('close pull request', 'github_update_pull_request', 'fail', errorMessage(error)));
      }
    }
    if (branchCreated && fileSha && tools['github_delete_file']) {
      try {
        await call('github_delete_file', {
          owner,
          repo,
          path: smokeFile,
          message: `smoke: remove ${smokeFile}`,
          sha: fileSha,
          branch: smokeBranch,
        });
        steps.push(makeStep('delete file', 'github_delete_file', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke file ${smokeFile} on ${smokeBranch}`, errorMessage(error));
        steps.push(makeStep('delete file', 'github_delete_file', 'fail', errorMessage(error)));
      }
    } else if (tools['github_delete_file']) {
      steps.push(
        await probeTool(call, tools, 'delete file (probe)', 'github_delete_file', {
          owner,
          repo,
          path: `.mastra-smoke/missing-${runId}.md`,
          message: 'probe',
          sha: '0000000000000000000000000000000000000000',
          branch: smokeBranch,
        }),
      );
    }
    // Branch cleanup: delete via create_branch's reverse isn't a tool; GitHub
    // exposes it via a plain refs delete, but no tool is generated for it.
    // The smoke branch stays until manually cleaned up — logged for operator.
    if (branchCreated) {
      log.warn(`Smoke branch ${smokeBranch} left behind on ${owner}/${repo} — delete manually if desired.`);
    }

    // Release lifecycle on a smoke tag.
    const releaseTag = `smoke-${runId}`;
    let releaseId: number | undefined;
    if (tools['github_create_release']) {
      try {
        const release = await call<{ id: number }>('github_create_release', {
          owner,
          repo,
          tag_name: releaseTag,
          name: `smoke ${runId}`,
          body: 'Automated @mastra/connect smoke release. Safe to delete.',
          draft: true,
          prerelease: true,
        });
        releaseId = release.id;
        steps.push(makeStep('create release', 'github_create_release', 'pass', String(releaseId)));
      } catch (error) {
        steps.push(makeStep('create release', 'github_create_release', 'fail', errorMessage(error)));
      }
    }
    if (releaseId && tools['github_get_release']) {
      try {
        await call('github_get_release', { owner, repo, release_id: releaseId });
        steps.push(makeStep('get release', 'github_get_release', 'pass'));
      } catch (error) {
        steps.push(makeStep('get release', 'github_get_release', 'fail', errorMessage(error)));
      }
    }
    if (releaseId && tools['github_update_release']) {
      try {
        await call('github_update_release', { owner, repo, release_id: releaseId, name: `smoke ${runId} (edit)` });
        steps.push(makeStep('update release', 'github_update_release', 'pass'));
      } catch (error) {
        steps.push(makeStep('update release', 'github_update_release', 'fail', errorMessage(error)));
      }
    }
    if (releaseId && tools['github_list_release_assets']) {
      try {
        await call('github_list_release_assets', { owner, repo, release_id: releaseId, per_page: 5 });
        steps.push(makeStep('list release assets', 'github_list_release_assets', 'pass'));
      } catch (error) {
        steps.push(makeStep('list release assets', 'github_list_release_assets', 'fail', errorMessage(error)));
      }
    }
    if (releaseId && tools['github_delete_release']) {
      try {
        await call('github_delete_release', { owner, repo, release_id: releaseId });
        steps.push(makeStep('delete release', 'github_delete_release', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke release ${releaseId}`, errorMessage(error));
        steps.push(makeStep('delete release', 'github_delete_release', 'fail', errorMessage(error)));
      }
    }

    // Tag object + ref: create a tag object pointing at the default commit,
    // then read via get_tag_ref. GitHub refs API doesn't delete via a tool.
    if (defaultSha && tools['github_create_tag_object']) {
      try {
        await call('github_create_tag_object', {
          owner,
          repo,
          tag: `smoke-tag-${runId}`,
          message: `smoke tag ${runId}`,
          object: defaultSha,
          type: 'commit',
          tagger_name: 'mastra smoke',
          tagger_email: 'mastra-smoke@example.com',
        });
        steps.push(makeStep('create tag object', 'github_create_tag_object', 'pass'));
      } catch (error) {
        steps.push(makeStep('create tag object', 'github_create_tag_object', 'fail', errorMessage(error)));
      }
    }
    // Tag ref: our provider doesn't expose a create-ref tool, so the smoke
    // tag object above has no accompanying ref. Resolve a real tag from the
    // repo's existing tags via list_tags and read its ref; fall back to a
    // probe only when the repo has no tags at all.
    if (tools['github_get_tag_ref']) {
      let realTagName: string | undefined;
      try {
        const tags = await call<Array<{ name?: string }>>('github_list_tags', { owner, repo, per_page: 1 });
        realTagName = tags[0]?.name;
      } catch {
        /* ignore — probe path handles it */
      }
      if (realTagName) {
        try {
          await call('github_get_tag_ref', { owner, repo, ref: `tags/${realTagName}` });
          steps.push(makeStep('get tag ref', 'github_get_tag_ref', 'pass', realTagName));
        } catch (error) {
          steps.push(makeStep('get tag ref', 'github_get_tag_ref', 'fail', errorMessage(error)));
        }
      } else {
        steps.push(
          await probeTool(call, tools, 'get tag ref (probe)', 'github_get_tag_ref', {
            owner,
            repo,
            ref: `tags/smoke-tag-${runId}`,
          }),
        );
      }
    }

    // Workflow surface: resolve first workflow + first run from list calls so
    // get_workflow / get_workflow_run / list_workflow_jobs operate on real
    // ids when the repo has any CI history. rerun stays a probe so we never
    // trigger billable compute from a smoke test.
    let workflowId: number | string | undefined;
    try {
      const wf = await call<{ workflows?: Array<{ id?: number; path?: string }> }>('github_list_workflows', {
        owner,
        repo,
        per_page: 5,
      });
      workflowId = wf.workflows?.[0]?.id ?? wf.workflows?.[0]?.path;
    } catch {
      /* no workflows configured; probe below still exercises endpoint */
    }
    if (tools['github_get_workflow']) {
      if (workflowId !== undefined) {
        try {
          await call('github_get_workflow', { owner, repo, workflow_id: workflowId });
          steps.push(makeStep('get workflow', 'github_get_workflow', 'pass'));
        } catch (error) {
          steps.push(makeStep('get workflow', 'github_get_workflow', 'fail', errorMessage(error)));
        }
      } else {
        steps.push(
          await probeTool(call, tools, 'get workflow (probe)', 'github_get_workflow', {
            owner,
            repo,
            workflow_id: 'nonexistent.yml',
          }),
        );
      }
    }
    let realRunId: number | undefined;
    if (tools['github_list_workflow_runs']) {
      try {
        const runs = await call<{ workflow_runs?: Array<{ id?: number }> }>('github_list_workflow_runs', {
          owner,
          repo,
          per_page: 5,
        });
        realRunId = runs.workflow_runs?.[0]?.id;
        steps.push(
          makeStep(
            'list workflow runs',
            'github_list_workflow_runs',
            'pass',
            realRunId !== undefined ? `latest=${realRunId}` : 'empty',
          ),
        );
      } catch (error) {
        steps.push(makeStep('list workflow runs', 'github_list_workflow_runs', 'fail', errorMessage(error)));
      }
    }
    if (tools['github_get_workflow_run']) {
      if (realRunId !== undefined) {
        try {
          await call('github_get_workflow_run', { owner, repo, run_id: realRunId });
          steps.push(makeStep('get workflow run', 'github_get_workflow_run', 'pass', String(realRunId)));
        } catch (error) {
          steps.push(makeStep('get workflow run', 'github_get_workflow_run', 'fail', errorMessage(error)));
        }
      } else {
        steps.push(
          await probeTool(call, tools, 'get workflow run (probe)', 'github_get_workflow_run', {
            owner,
            repo,
            run_id: 1,
          }),
        );
      }
    }
    if (tools['github_list_workflow_jobs']) {
      if (realRunId !== undefined) {
        try {
          await call('github_list_workflow_jobs', { owner, repo, run_id: realRunId, per_page: 5 });
          steps.push(makeStep('list workflow jobs', 'github_list_workflow_jobs', 'pass', String(realRunId)));
        } catch (error) {
          steps.push(makeStep('list workflow jobs', 'github_list_workflow_jobs', 'fail', errorMessage(error)));
        }
      } else {
        steps.push(
          await probeTool(call, tools, 'list workflow jobs (probe)', 'github_list_workflow_jobs', {
            owner,
            repo,
            run_id: 1,
          }),
        );
      }
    }
    if (tools['github_rerun_workflow_run']) {
      // Always a synthetic run id: re-running a real workflow consumes
      // Actions minutes. run_id 1 never exists in this repo, so GitHub
      // answers 404 and nothing is re-run.
      steps.push(
        await probeTool(call, tools, 'rerun workflow run (probe)', 'github_rerun_workflow_run', {
          owner,
          repo,
          run_id: 1,
        }),
      );
    }

    const labelName = `${runId}-label`;
    let labelCreated = false;
    if (tools['github_create_label']) {
      try {
        await call('github_create_label', {
          owner,
          repo,
          name: labelName,
          color: 'ff8800',
          description: 'smoke test label',
        });
        labelCreated = true;
        steps.push(makeStep('create label', 'github_create_label', 'pass'));
      } catch (error) {
        steps.push(makeStep('create label', 'github_create_label', 'fail', errorMessage(error)));
      }
    }

    if (labelCreated && tools['github_get_label']) {
      try {
        await call('github_get_label', { owner, repo, name: labelName });
        steps.push(makeStep('get label', 'github_get_label', 'pass'));
      } catch (error) {
        steps.push(makeStep('get label', 'github_get_label', 'fail', errorMessage(error)));
      }
    }

    if (labelCreated && tools['github_update_label']) {
      try {
        await call('github_update_label', {
          owner,
          repo,
          name: labelName,
          description: 'smoke test label (updated)',
        });
        steps.push(makeStep('update label', 'github_update_label', 'pass'));
      } catch (error) {
        steps.push(makeStep('update label', 'github_update_label', 'fail', errorMessage(error)));
      }
    }

    if (labelCreated && tools['github_delete_label']) {
      try {
        await call('github_delete_label', { owner, repo, name: labelName });
        steps.push(makeStep('delete label', 'github_delete_label', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke label ${labelName} — clean up manually.`, errorMessage(error));
        steps.push(makeStep('delete label', 'github_delete_label', 'fail', errorMessage(error)));
      }
    }

    // GitHub has no issue delete; closing is the cleanup path.
    try {
      await call('github_update_issue', {
        owner,
        repo,
        issue_number: issueNumber,
        state: 'closed',
      });
      steps.push(makeStep('close issue', 'github_update_issue', 'pass'));
    } catch (error) {
      log.error(`Failed to close smoke issue #${issueNumber} — clean up manually.`, errorMessage(error));
      steps.push(makeStep('close issue', 'github_update_issue', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
