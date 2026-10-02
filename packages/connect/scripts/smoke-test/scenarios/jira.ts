import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Jira scenario: issue + comment + worklog + transition CRUD against the
 * first project the token can see.
 *
 * Jira tools map 1:1 to the native REST API, so inputs are the Atlassian
 * payloads themselves rather than normalized high-level params. Casing is
 * mixed across tools because the Nango templates mirror the upstream
 * endpoints exactly: jira_create_issue takes `fields.project/issuetype`,
 * jira_update_issue takes `issue_id_or_key` (snake), jira_add_worklog takes
 * `issue_id_or_key` + `time_spent_seconds` (snake + numeric), but
 * jira_update_worklog and jira_delete_worklog take `issueIdOrKey`
 * (camel). The scenario matches each tool's actual schema.
 *
 * jira_update_comment requires an Atlassian Document Format `body` and a
 * `visibility` object; building a real ADF is heavier than useful in a smoke
 * run, so we exercise add/list/delete but skip update_comment.
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

    const projects = await call<{ projects?: Array<{ id?: string; key?: string; name?: string }> }>(
      'jira_list_projects',
      {},
    );
    const project = (projects.projects ?? []).find(p => p.key && p.id);
    if (!project?.key || !project.id) {
      steps.push(makeStep('pick project', 'jira_list_projects', 'skip', 'No Jira project visible.'));
      return steps;
    }
    steps.push(makeStep('pick project', 'jira_list_projects', 'pass', project.key));

    const types = await call<{ issueTypes?: Array<{ id?: string; name?: string; subtask?: boolean }> }>(
      'jira_list_issue_types',
      { projectId: project.id },
    );
    const issueType = (types.issueTypes ?? []).find(t => t.id && !t.subtask) ?? (types.issueTypes ?? [])[0];
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
    try {
      const created = await call<{ id: string; key: string }>('jira_create_issue', {
        fields: {
          project: { key: project.key },
          issuetype: { id: issueType.id },
          summary,
        },
      });
      issueKey = created.key;
      steps.push(makeStep('create issue', 'jira_create_issue', 'pass', issueKey));
    } catch (error) {
      steps.push(makeStep('create issue', 'jira_create_issue', 'fail', errorMessage(error)));
      return steps;
    }

    try {
      const got = await call<{ key?: string }>('jira_get_issue', { issueIdOrKey: issueKey });
      const ok = got.key === issueKey;
      steps.push(makeStep('read issue', 'jira_get_issue', ok ? 'pass' : 'fail', got.key));
    } catch (error) {
      steps.push(makeStep('read issue', 'jira_get_issue', 'fail', errorMessage(error)));
    }

    try {
      await call('jira_update_issue', {
        issue_id_or_key: issueKey,
        fields: { summary: `${summary} (renamed)` },
      });
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
          issue_id_or_key: issueKey,
          time_spent_seconds: 300,
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

    try {
      await call('jira_delete_issue', { issueIdOrKey: issueKey });
      steps.push(makeStep('delete issue', 'jira_delete_issue', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke Jira issue ${issueKey} — clean up manually.`, errorMessage(error));
      steps.push(makeStep('delete issue', 'jira_delete_issue', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
