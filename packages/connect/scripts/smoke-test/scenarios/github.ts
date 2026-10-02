import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep GitHub scenario: issue + comment + label lifecycle in the first repo
 * the authenticated user has write access to. Repository creation is out of
 * scope because repos are workspace-level objects; the scenario relies on the
 * token already having an active repo it can post to.
 */
export const githubScenario: Scenario = {
  integrationId: 'github',
  summary: 'issue + comment + label CRUD + repo reads',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'github_list_repositories',
      'github_create_issue',
      'github_get_issue',
      'github_update_issue',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const repos = await call<{
      items?: Array<{
        full_name?: string;
        owner?: { login?: string };
        name?: string;
        permissions?: { push?: boolean };
      }>;
    }>('github_list_repositories', { per_page: 20 });
    const writable = (repos.items ?? []).find(
      r => r.permissions?.push === true && typeof r.owner?.login === 'string' && typeof r.name === 'string',
    );
    if (!writable?.owner?.login || !writable.name) {
      steps.push(
        makeStep('pick repo', 'github_list_repositories', 'skip', 'No writable repo visible to the connected user.'),
      );
      return steps;
    }
    const owner = writable.owner.login;
    const repo = writable.name;
    steps.push(makeStep('pick repo', 'github_list_repositories', 'pass', `${owner}/${repo}`));

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['github_get_authenticated_user', {}],
          ['github_list_issues', { owner, repo, per_page: 5 }],
          ['github_list_labels', { owner, repo, per_page: 5 }],
          ['github_list_pull_requests', { owner, repo, per_page: 5, state: 'all' }],
          ['github_list_workflows', { owner, repo, per_page: 5 }],
          ['github_list_releases', { owner, repo, per_page: 5 }],
          ['github_list_branches', { owner, repo, per_page: 5 }],
          ['github_list_commits', { owner, repo, per_page: 5 }],
          ['github_list_collaborators', { owner, repo, per_page: 5 }],
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

    if (tools['github_create_issue_comment']) {
      try {
        await call('github_create_issue_comment', {
          owner,
          repo,
          issue_number: issueNumber,
          body: `${runId} smoke comment`,
        });
        steps.push(makeStep('create issue comment', 'github_create_issue_comment', 'pass'));
      } catch (error) {
        steps.push(makeStep('create issue comment', 'github_create_issue_comment', 'fail', errorMessage(error)));
      }
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
