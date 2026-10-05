import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

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
          ['jira_list_users', { query: 'a', maxResults: 5 }],
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

    // Transition the issue to the first available transition (if any).
    if (tools['jira_transition_issue']) {
      try {
        const t = await call<{ transitions?: Array<{ id?: string }> }>('jira_list_transitions', {
          issueIdOrKey: issueKey,
        });
        const transitionId = t.transitions?.[0]?.id;
        if (transitionId) {
          await call('jira_transition_issue', { issueIdOrKey: issueKey, transitionId });
          steps.push(makeStep('transition issue', 'jira_transition_issue', 'pass', transitionId));
        } else {
          steps.push(
            makeStep('transition issue', 'jira_transition_issue', 'skip', 'No transitions available for issue.'),
          );
        }
      } catch (error) {
        steps.push(makeStep('transition issue', 'jira_transition_issue', 'fail', errorMessage(error)));
      }
    }

    // Changelog + edit-metadata + search read surface on the created issue.
    if (tools['jira_get_issue_changelog']) {
      try {
        await call('jira_get_issue_changelog', { issueIdOrKey: issueKey });
        steps.push(makeStep('get issue changelog', 'jira_get_issue_changelog', 'pass'));
      } catch (error) {
        steps.push(makeStep('get issue changelog', 'jira_get_issue_changelog', 'fail', errorMessage(error)));
      }
    }
    if (tools['jira_get_edit_issue_metadata']) {
      try {
        await call('jira_get_edit_issue_metadata', { issueIdOrKey: issueKey });
        steps.push(makeStep('get edit metadata', 'jira_get_edit_issue_metadata', 'pass'));
      } catch (error) {
        steps.push(makeStep('get edit metadata', 'jira_get_edit_issue_metadata', 'fail', errorMessage(error)));
      }
    }
    if (tools['jira_get_create_issue_metadata']) {
      try {
        await call('jira_get_create_issue_metadata', { projectKeys: [project.key] });
        steps.push(makeStep('get create metadata', 'jira_get_create_issue_metadata', 'pass'));
      } catch (error) {
        steps.push(makeStep('get create metadata', 'jira_get_create_issue_metadata', 'fail', errorMessage(error)));
      }
    }
    if (tools['jira_search_issues']) {
      try {
        await call('jira_search_issues', { jql: `project = ${project.key}`, maxResults: 5 });
        steps.push(makeStep('search issues', 'jira_search_issues', 'pass'));
      } catch (error) {
        steps.push(makeStep('search issues', 'jira_search_issues', 'fail', errorMessage(error)));
      }
    }

    // Watcher read + remove on the created issue.
    if (tools['jira_list_watchers']) {
      try {
        await call('jira_list_watchers', { issueIdOrKey: issueKey });
        steps.push(makeStep('list watchers', 'jira_list_watchers', 'pass'));
      } catch (error) {
        steps.push(makeStep('list watchers', 'jira_list_watchers', 'fail', errorMessage(error)));
      }
    }
    if (tools['jira_remove_watcher']) {
      steps.push(
        await probeTool(call, tools, 'remove watcher (probe)', 'jira_remove_watcher', {
          issueIdOrKey: issueKey,
          accountId: 'smoke-nonexistent-account',
        }),
      );
    }
    if (tools['jira_list_worklogs']) {
      try {
        await call('jira_list_worklogs', { issueIdOrKey: issueKey });
        steps.push(makeStep('list worklogs', 'jira_list_worklogs', 'pass'));
      } catch (error) {
        steps.push(makeStep('list worklogs', 'jira_list_worklogs', 'fail', errorMessage(error)));
      }
    }

    // Project / field / status / priority / issue-type / user getters.
    if (tools['jira_get_project']) {
      try {
        await call('jira_get_project', { projectIdOrKey: project.key });
        steps.push(makeStep('get project', 'jira_get_project', 'pass'));
      } catch (error) {
        steps.push(makeStep('get project', 'jira_get_project', 'fail', errorMessage(error)));
      }
    }
    if (tools['jira_get_issue_type']) {
      try {
        await call('jira_get_issue_type', { id: issueType.id });
        steps.push(makeStep('get issue type', 'jira_get_issue_type', 'pass'));
      } catch (error) {
        steps.push(makeStep('get issue type', 'jira_get_issue_type', 'fail', errorMessage(error)));
      }
    }
    if (tools['jira_get_status']) {
      steps.push(await probeTool(call, tools, 'get status (probe)', 'jira_get_status', { statusIdOrName: 'To Do' }));
    }
    if (tools['jira_get_priority']) {
      steps.push(await probeTool(call, tools, 'get priority (probe)', 'jira_get_priority', { priorityId: '1' }));
    }
    if (tools['jira_get_field']) {
      steps.push(await probeTool(call, tools, 'get field (probe)', 'jira_get_field', { fieldId: 'summary' }));
    }
    if (tools['jira_get_user']) {
      steps.push(await probeTool(call, tools, 'get user (probe)', 'jira_get_user', { accountId: 'smoke-nonexistent' }));
    }

    // Issue-link lifecycle: create second issue for linking, then link + unlink.
    let secondIssueKey: string | undefined;
    if (tools['jira_create_issue_link']) {
      try {
        const second = await call<{ key: string }>('jira_create_issue', {
          fields: {
            project: { key: project.key },
            issuetype: { id: issueType.id },
            summary: `${summary} (link target)`,
          },
        });
        secondIssueKey = second.key;
        steps.push(makeStep('create second issue (for link)', 'jira_create_issue', 'pass', secondIssueKey));
      } catch (error) {
        steps.push(makeStep('create second issue (for link)', 'jira_create_issue', 'fail', errorMessage(error)));
      }
    }
    let linkId: string | undefined;
    if (secondIssueKey && tools['jira_create_issue_link']) {
      try {
        const link = await call<{ id?: string }>('jira_create_issue_link', {
          type: 'Relates',
          inwardIssueKey: issueKey,
          outwardIssueKey: secondIssueKey,
        });
        linkId = link.id;
        steps.push(makeStep('create issue link', 'jira_create_issue_link', 'pass', linkId));
      } catch (error) {
        steps.push(makeStep('create issue link', 'jira_create_issue_link', 'fail', errorMessage(error)));
      }
    }
    if (linkId && tools['jira_delete_issue_link']) {
      try {
        await call('jira_delete_issue_link', { linkId });
        steps.push(makeStep('delete issue link', 'jira_delete_issue_link', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete issue link', 'jira_delete_issue_link', 'fail', errorMessage(error)));
      }
    } else if (tools['jira_delete_issue_link']) {
      steps.push(
        await probeTool(call, tools, 'delete issue link (probe)', 'jira_delete_issue_link', {
          linkId: `smoke-${runId}`,
        }),
      );
    }
    if (secondIssueKey) {
      try {
        await call('jira_delete_issue', { issueIdOrKey: secondIssueKey });
        steps.push(makeStep('delete second issue', 'jira_delete_issue', 'pass'));
      } catch (error) {
        log.error(`Failed to delete second smoke issue ${secondIssueKey}`, errorMessage(error));
        steps.push(makeStep('delete second issue', 'jira_delete_issue', 'fail', errorMessage(error)));
      }
    }

    // Attachment delete probe (Jira attachments need multipart upload, which
    // we don't bootstrap; probe with synthetic id proves routing).
    if (tools['jira_delete_attachment']) {
      steps.push(
        await probeTool(call, tools, 'delete attachment (probe)', 'jira_delete_attachment', {
          id: `smoke-${runId}`,
        }),
      );
    }

    // update_comment requires Atlassian Document Format body + visibility
    // object; probe with minimal payload accepting 400/404 as endpoint proof.
    if (tools['jira_update_comment']) {
      steps.push(
        await probeTool(call, tools, 'update comment (probe)', 'jira_update_comment', {
          issueIdOrKey: issueKey,
          commentId: `smoke-${runId}`,
          body: { type: 'doc', version: 1, content: [] },
          visibility: { type: 'role', value: 'Administrators' },
        }),
      );
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
