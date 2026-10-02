import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Jira scenario: issue + comment + worklog + transition lifecycle. Uses
 * the first project the token can post to and the project's first issue type.
 */
export const jiraScenario: Scenario = {
  integrationId: 'jira',
  summary: 'issue + comment + worklog + transition CRUD',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'jira_list_projects',
      'jira_list_issue_types',
      'jira_create_issue',
      'jira_get_issue',
      'jira_update_issue',
      'jira_delete_issue',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const projects = await call<{ items?: Array<{ id?: string; key?: string; name?: string }> }>(
      'jira_list_projects',
      {},
    );
    const project = (projects.items ?? []).find(p => p.key && p.id);
    if (!project?.key || !project.id) {
      steps.push(makeStep('pick project', 'jira_list_projects', 'skip', 'No Jira project visible.'));
      return steps;
    }
    steps.push(makeStep('pick project', 'jira_list_projects', 'pass', project.key));

    const types = await call<{ items?: Array<{ id?: string; name?: string; subtask?: boolean }> }>(
      'jira_list_issue_types',
      {
        projectId: project.id,
      },
    );
    const issueType = (types.items ?? []).find(t => t.id && !t.subtask) ?? (types.items ?? [])[0];
    if (!issueType?.id) {
      steps.push(makeStep('pick issue type', 'jira_list_issue_types', 'skip', 'No issue types visible.'));
      return steps;
    }
    steps.push(makeStep('pick issue type', 'jira_list_issue_types', 'pass', issueType.name ?? issueType.id));

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['jira_get_myself', {}],
          ['jira_list_statuses', { projectId: project.id }],
          ['jira_list_priorities', {}],
          ['jira_list_users', { maxResults: 5 }],
          ['jira_list_fields', {}],
          ['jira_list_project_components', { projectIdOrKey: project.key }],
          ['jira_list_project_versions', { projectIdOrKey: project.key }],
        ],
        tools,
      )),
    );

    const summary = `${runId} smoke issue`;
    let issueKey: string | undefined;
    let issueId: string | undefined;
    try {
      const created = await call<{ id: string; key: string }>('jira_create_issue', {
        projectKey: project.key,
        issueTypeId: issueType.id,
        summary,
        description: 'Automated @mastra/connect smoke test.',
      });
      issueKey = created.key;
      issueId = created.id;
      steps.push(makeStep('create issue', 'jira_create_issue', 'pass', issueKey));
    } catch (error) {
      steps.push(makeStep('create issue', 'jira_create_issue', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      const got = await call<{ fields?: { summary?: string } }>('jira_get_issue', { issueIdOrKey: issueKey });
      const ok = got.fields?.summary === summary;
      steps.push(makeStep('read issue', 'jira_get_issue', ok ? 'pass' : 'fail'));
    } catch (error) {
      steps.push(makeStep('read issue', 'jira_get_issue', 'fail', errorMessage(error)));
    }

    try {
      await call('jira_update_issue', { issueIdOrKey: issueKey, summary: `${summary} (renamed)` });
      steps.push(makeStep('update issue', 'jira_update_issue', 'pass'));
    } catch (error) {
      steps.push(makeStep('update issue', 'jira_update_issue', 'fail', errorMessage(error)));
    }

    let commentId: string | undefined;
    if (tools['jira_add_comment']) {
      try {
        const comment = await call<{ id: string }>('jira_add_comment', {
          issueIdOrKey: issueKey,
          body: `${runId} smoke comment`,
        });
        commentId = comment.id;
        steps.push(makeStep('add comment', 'jira_add_comment', 'pass', commentId));
      } catch (error) {
        steps.push(makeStep('add comment', 'jira_add_comment', 'fail', errorMessage(error)));
      }
    }

    if (commentId && tools['jira_update_comment']) {
      try {
        await call('jira_update_comment', { issueIdOrKey: issueKey, commentId, body: 'edited' });
        steps.push(makeStep('update comment', 'jira_update_comment', 'pass'));
      } catch (error) {
        steps.push(makeStep('update comment', 'jira_update_comment', 'fail', errorMessage(error)));
      }
    }

    if (tools['jira_list_issue_comments']) {
      try {
        await call('jira_list_issue_comments', { issueIdOrKey: issueKey });
        steps.push(makeStep('list comments', 'jira_list_issue_comments', 'pass'));
      } catch (error) {
        steps.push(makeStep('list comments', 'jira_list_issue_comments', 'fail', errorMessage(error)));
      }
    }

    if (commentId && tools['jira_delete_comment']) {
      try {
        await call('jira_delete_comment', { issueIdOrKey: issueKey, commentId });
        steps.push(makeStep('delete comment', 'jira_delete_comment', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete comment', 'jira_delete_comment', 'fail', errorMessage(error)));
      }
    }

    let worklogId: string | undefined;
    if (tools['jira_add_worklog']) {
      try {
        const worklog = await call<{ id: string }>('jira_add_worklog', {
          issueIdOrKey: issueKey,
          timeSpent: '5m',
          comment: `${runId} smoke worklog`,
        });
        worklogId = worklog.id;
        steps.push(makeStep('add worklog', 'jira_add_worklog', 'pass', worklogId));
      } catch (error) {
        steps.push(makeStep('add worklog', 'jira_add_worklog', 'fail', errorMessage(error)));
      }
    }

    if (worklogId && tools['jira_update_worklog']) {
      try {
        await call('jira_update_worklog', {
          issueIdOrKey: issueKey,
          worklogId,
          comment: 'edited worklog',
        });
        steps.push(makeStep('update worklog', 'jira_update_worklog', 'pass'));
      } catch (error) {
        steps.push(makeStep('update worklog', 'jira_update_worklog', 'fail', errorMessage(error)));
      }
    }

    if (worklogId && tools['jira_delete_worklog']) {
      try {
        await call('jira_delete_worklog', { issueIdOrKey: issueKey, worklogId });
        steps.push(makeStep('delete worklog', 'jira_delete_worklog', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete worklog', 'jira_delete_worklog', 'fail', errorMessage(error)));
      }
    }

    if (tools['jira_list_transitions']) {
      try {
        await call('jira_list_transitions', { issueIdOrKey: issueKey });
        steps.push(makeStep('list transitions', 'jira_list_transitions', 'pass'));
      } catch (error) {
        steps.push(makeStep('list transitions', 'jira_list_transitions', 'fail', errorMessage(error)));
      }
    }

    if (issueId) {
      try {
        await call('jira_delete_issue', { issueIdOrKey: issueKey });
        steps.push(makeStep('delete issue', 'jira_delete_issue', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke Jira issue ${issueKey} — clean up manually.`, errorMessage(error));
        steps.push(makeStep('delete issue', 'jira_delete_issue', 'fail', errorMessage(error)));
      }
    }

    return steps;
  },
};
