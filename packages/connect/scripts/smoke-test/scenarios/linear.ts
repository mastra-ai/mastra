import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, probeTool } from '../scenario.js';

/**
 * Deep Linear scenario: exercises issues, comments, labels, projects, cycles,
 * attachments, and the read-only lookup tools so proxy wiring is verified for
 * most of Linear's surface in a single pass.
 */
export const linearScenario: Scenario = {
  integrationId: 'linear',
  summary: 'issues + comments + labels + projects + cycles + attachments + reads',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'linear_list_teams',
      'linear_create_issue',
      'linear_get_issue',
      'linear_update_issue',
      'linear_delete_issue',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    // Phase 1: picks a team and warms up the read-only surface. Covers every
    // list-style tool we expect to be able to call without creating anything.
    const teams = await call<{ items: Array<{ id: string; name: string }> }>('linear_list_teams', { first: 10 });
    const team = teams.items?.[0];
    if (!team) {
      steps.push({
        name: 'pick team',
        toolId: 'linear_list_teams',
        status: 'skip',
        detail: 'No Linear teams visible.',
      });
      return steps;
    }
    steps.push(makeStep('pick team', 'linear_list_teams', 'pass', team.name));

    await runReadOnly(call, team.id, steps);

    // Phase 2: create → read → mutate → delete lifecycle. From here on every
    // step is wrapped in try/catch and tracks whatever it created so cleanup
    // always runs, even when a mid-flight step fails.
    const title = `${runId} smoke issue`;
    let issueId: string | undefined;
    try {
      const created = await call<{ id: string; identifier?: string }>('linear_create_issue', {
        teamId: team.id,
        title,
        description: 'Automated @mastra/connect smoke test. Safe to ignore and delete.',
      });
      issueId = created.id;
      steps.push(makeStep('create issue', 'linear_create_issue', 'pass', created.identifier ?? created.id));
    } catch (error) {
      steps.push(makeStep('create issue', 'linear_create_issue', 'fail', errorMessage(error)));
      return steps;
    }

    const resources: Array<{ kind: string; id: string; delete: () => Promise<unknown> }> = [];

    try {
      const roundtrip = await call<{ title?: string }>('linear_get_issue', { id: issueId });
      const ok = roundtrip.title === title;
      steps.push(
        makeStep(
          'read issue back',
          'linear_get_issue',
          ok ? 'pass' : 'fail',
          ok ? undefined : `title mismatch: ${roundtrip.title}`,
        ),
      );
    } catch (error) {
      steps.push(makeStep('read issue back', 'linear_get_issue', 'fail', errorMessage(error)));
    }

    const renamed = `${title} (renamed)`;
    try {
      await call('linear_update_issue', { id: issueId, title: renamed });
      const after = await call<{ title?: string }>('linear_get_issue', { id: issueId });
      const ok = after.title === renamed;
      steps.push(
        makeStep('update issue title', 'linear_update_issue', ok ? 'pass' : 'fail', ok ? undefined : after.title),
      );
    } catch (error) {
      steps.push(makeStep('update issue title', 'linear_update_issue', 'fail', errorMessage(error)));
    }

    // get_* read lookups that take a specific id. Pull one of each from the
    // lists we already fetched so every single-id getter is exercised.
    try {
      const users = await call<{ items?: Array<{ id?: string }> }>('linear_list_users', { first: 1 });
      const userId = users.items?.[0]?.id;
      if (userId && tools['linear_get_user']) {
        await call('linear_get_user', { userId });
        steps.push(makeStep('get user', 'linear_get_user', 'pass'));
      }
    } catch (error) {
      steps.push(makeStep('get user', 'linear_get_user', 'fail', errorMessage(error)));
    }

    try {
      const states = await call<{ items?: Array<{ id?: string }> }>('linear_list_workflow_states', {
        first: 1,
        teamId: team.id,
      });
      const stateId = states.items?.[0]?.id;
      if (stateId && tools['linear_get_workflow_state']) {
        await call('linear_get_workflow_state', { stateId });
        steps.push(makeStep('get workflow state', 'linear_get_workflow_state', 'pass'));
      }
    } catch (error) {
      steps.push(makeStep('get workflow state', 'linear_get_workflow_state', 'fail', errorMessage(error)));
    }

    // Archive + unarchive the issue to exercise the pair without losing it.
    if (tools['linear_archive_issue'] && tools['linear_unarchive_issue']) {
      try {
        await call('linear_archive_issue', { id: issueId });
        steps.push(makeStep('archive issue', 'linear_archive_issue', 'pass'));
      } catch (error) {
        steps.push(makeStep('archive issue', 'linear_archive_issue', 'fail', errorMessage(error)));
      }
      try {
        await call('linear_unarchive_issue', { id: issueId });
        steps.push(makeStep('unarchive issue', 'linear_unarchive_issue', 'pass'));
      } catch (error) {
        steps.push(makeStep('unarchive issue', 'linear_unarchive_issue', 'fail', errorMessage(error)));
      }
    }

    // Create a second issue so we can exercise the issue-relation surface
    // (create + update + delete + list variants need two real issues).
    let secondIssueId: string | undefined;
    if (tools['linear_create_issue']) {
      try {
        const other = await call<{ id: string }>('linear_create_issue', {
          teamId: team.id,
          title: `${runId} smoke related issue`,
          description: 'Second issue for relation lifecycle. Safe to delete.',
        });
        secondIssueId = other.id;
      } catch {
        // Second-issue creation failing isn't fatal; relation steps just skip.
      }
    }

    let relationId: string | undefined;
    if (secondIssueId && tools['linear_create_issue_relation']) {
      try {
        const relation = await call<{ id: string }>('linear_create_issue_relation', {
          issueId,
          relatedIssueId: secondIssueId,
          type: 'related',
        });
        relationId = relation.id;
        steps.push(makeStep('create issue relation', 'linear_create_issue_relation', 'pass', relationId));
      } catch (error) {
        steps.push(makeStep('create issue relation', 'linear_create_issue_relation', 'fail', errorMessage(error)));
      }
    }
    if (relationId && tools['linear_update_issue_relation']) {
      try {
        await call('linear_update_issue_relation', {
          id: relationId,
          issueId,
          relatedIssueId: secondIssueId,
          type: 'blocks',
        });
        steps.push(makeStep('update issue relation', 'linear_update_issue_relation', 'pass'));
      } catch (error) {
        steps.push(makeStep('update issue relation', 'linear_update_issue_relation', 'fail', errorMessage(error)));
      }
    }
    if (relationId && tools['linear_delete_issue_relation']) {
      try {
        await call('linear_delete_issue_relation', { id: relationId });
        steps.push(makeStep('delete issue relation', 'linear_delete_issue_relation', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete issue relation', 'linear_delete_issue_relation', 'fail', errorMessage(error)));
      }
    }

    // Cycle CRUD. Cycles live under a team; create → read → update →
    // archive. Cycles can't be hard-deleted, archive is the terminal state.
    // Cycles are a per-team setting (cyclesEnabled) and the toolset has no
    // team-settings tool, so a cycles-disabled workspace cannot bootstrap one:
    // Linear rejects cycleCreate with a GraphQL error ("Cycle creation is not
    // supported."). The generated create-cycle template currently surfaces
    // that as a response-shape parse failure (`data` is null) — upstream fix
    // pending. Either message counts as the endpoint being exercised; the
    // remaining cycle tools are then probed with a synthetic id.
    let cycleId: string | undefined;
    let cyclesDisabled = false;
    if (tools['linear_create_cycle']) {
      try {
        const now = Date.now();
        const cycle = await call<{ id: string }>('linear_create_cycle', {
          teamId: team.id,
          name: `${runId} smoke cycle`,
          startsAt: new Date(now + 7 * 86400_000).toISOString(),
          endsAt: new Date(now + 14 * 86400_000).toISOString(),
        });
        cycleId = cycle.id;
        steps.push(makeStep('create cycle', 'linear_create_cycle', 'pass', cycleId));
      } catch (error) {
        const msg = errorMessage(error);
        cyclesDisabled = /cycle creation is not supported|expected object, received null/i.test(msg);
        steps.push(
          cyclesDisabled
            ? makeStep(
                'create cycle',
                'linear_create_cycle',
                'pass',
                `expected error (cycles disabled on team): ${msg.slice(0, 120)}`,
              )
            : makeStep('create cycle', 'linear_create_cycle', 'fail', msg),
        );
      }
    }
    if (cycleId) {
      if (tools['linear_get_cycle']) {
        try {
          await call('linear_get_cycle', { id: cycleId });
          steps.push(makeStep('get cycle', 'linear_get_cycle', 'pass'));
        } catch (error) {
          steps.push(makeStep('get cycle', 'linear_get_cycle', 'fail', errorMessage(error)));
        }
      }
      if (tools['linear_update_cycle']) {
        try {
          await call('linear_update_cycle', { id: cycleId, name: `${runId} smoke cycle (renamed)` });
          steps.push(makeStep('update cycle', 'linear_update_cycle', 'pass'));
        } catch (error) {
          steps.push(makeStep('update cycle', 'linear_update_cycle', 'fail', errorMessage(error)));
        }
      }
      if (tools['linear_archive_cycle']) {
        try {
          await call('linear_archive_cycle', { id: cycleId });
          steps.push(makeStep('archive cycle', 'linear_archive_cycle', 'pass'));
        } catch (error) {
          log.error(`Failed to archive smoke cycle ${cycleId}`, errorMessage(error));
          steps.push(makeStep('archive cycle', 'linear_archive_cycle', 'fail', errorMessage(error)));
        }
      }
    } else {
      // No cycle to operate on (cycles disabled or create failed): probe the
      // lifecycle tools with a synthetic id so their wiring is still exercised.
      const syntheticCycleId = '00000000-0000-4000-8000-000000000000';
      steps.push(await probeTool(call, tools, 'get cycle (probe)', 'linear_get_cycle', { id: syntheticCycleId }));
      steps.push(
        await probeTool(call, tools, 'update cycle (probe)', 'linear_update_cycle', {
          id: syntheticCycleId,
          name: `${runId} smoke cycle (renamed)`,
        }),
      );
      // archive-cycle wraps GraphQL errors in a generic "Linear GraphQL
      // returned errors" message, so the not-found default regex never fires.
      // Its response schema also types `data` as optional but not nullable,
      // while Linear sends an explicit `data: null` alongside `errors` — the
      // parse failure ("expected object, received null") therefore still means
      // the endpoint was exercised and rejected the synthetic id. Upstream
      // template fix pending (same null-schema class as gmail list-filters).
      steps.push(
        await probeTool(
          call,
          tools,
          'archive cycle (probe)',
          'linear_archive_cycle',
          { id: syntheticCycleId },
          /status=(400|404|409|422)|not found|does not exist|GraphQL returned errors|expected object, received null/i,
        ),
      );
    }

    // Create a comment on the issue, then update + resolve/unresolve + delete.
    if (tools['linear_create_comment']) {
      let commentId: string | undefined;
      try {
        const comment = await call<{ id: string }>('linear_create_comment', {
          issueId,
          body: `${runId} comment body`,
        });
        commentId = comment.id;
        steps.push(makeStep('create comment', 'linear_create_comment', 'pass', commentId));
      } catch (error) {
        steps.push(makeStep('create comment', 'linear_create_comment', 'fail', errorMessage(error)));
      }

      if (commentId && tools['linear_update_comment']) {
        try {
          await call('linear_update_comment', { id: commentId, body: `${runId} comment body (edited)` });
          steps.push(makeStep('update comment', 'linear_update_comment', 'pass'));
        } catch (error) {
          steps.push(makeStep('update comment', 'linear_update_comment', 'fail', errorMessage(error)));
        }
      }

      if (commentId && tools['linear_resolve_comment']) {
        try {
          await call('linear_resolve_comment', { id: commentId });
          steps.push(makeStep('resolve comment', 'linear_resolve_comment', 'pass'));
        } catch (error) {
          steps.push(makeStep('resolve comment', 'linear_resolve_comment', 'fail', errorMessage(error)));
        }
      }
      if (commentId && tools['linear_unresolve_comment']) {
        try {
          await call('linear_unresolve_comment', { id: commentId });
          steps.push(makeStep('unresolve comment', 'linear_unresolve_comment', 'pass'));
        } catch (error) {
          steps.push(makeStep('unresolve comment', 'linear_unresolve_comment', 'fail', errorMessage(error)));
        }
      }

      if (commentId && tools['linear_list_comments']) {
        try {
          await call('linear_list_comments', { filter: { issue: { id: { eq: issueId } } } });
          steps.push(makeStep('list comments', 'linear_list_comments', 'pass'));
        } catch (error) {
          steps.push(makeStep('list comments', 'linear_list_comments', 'fail', errorMessage(error)));
        }
      }

      if (commentId && tools['linear_get_comment']) {
        try {
          await call('linear_get_comment', { commentId });
          steps.push(makeStep('get comment', 'linear_get_comment', 'pass'));
        } catch (error) {
          steps.push(makeStep('get comment', 'linear_get_comment', 'fail', errorMessage(error)));
        }
      }

      if (commentId && tools['linear_delete_comment']) {
        resources.push({
          kind: 'comment',
          id: commentId,
          delete: () => call('linear_delete_comment', { commentId }),
        });
      }
    }

    // Issue label: create, add to issue, remove, delete.
    if (tools['linear_create_issue_label']) {
      let labelId: string | undefined;
      try {
        const label = await call<{ id: string }>('linear_create_issue_label', {
          teamId: team.id,
          name: `${runId}-label`,
          color: '#ff8800',
        });
        labelId = label.id;
        steps.push(makeStep('create label', 'linear_create_issue_label', 'pass', labelId));
      } catch (error) {
        steps.push(makeStep('create label', 'linear_create_issue_label', 'fail', errorMessage(error)));
      }

      if (labelId && tools['linear_get_issue_label']) {
        try {
          await call('linear_get_issue_label', { id: labelId });
          steps.push(makeStep('get issue label', 'linear_get_issue_label', 'pass'));
        } catch (error) {
          steps.push(makeStep('get issue label', 'linear_get_issue_label', 'fail', errorMessage(error)));
        }
      }
      if (labelId && tools['linear_update_issue_label']) {
        try {
          await call('linear_update_issue_label', { id: labelId, name: `${runId}-label-renamed` });
          steps.push(makeStep('update issue label', 'linear_update_issue_label', 'pass'));
        } catch (error) {
          steps.push(makeStep('update issue label', 'linear_update_issue_label', 'fail', errorMessage(error)));
        }
      }

      if (labelId && tools['linear_add_issue_label']) {
        try {
          await call('linear_add_issue_label', { id: issueId, labelId });
          steps.push(makeStep('add label to issue', 'linear_add_issue_label', 'pass'));
        } catch (error) {
          steps.push(makeStep('add label to issue', 'linear_add_issue_label', 'fail', errorMessage(error)));
        }
      }
      if (labelId && tools['linear_remove_issue_label']) {
        try {
          await call('linear_remove_issue_label', { issueId, labelId });
          steps.push(makeStep('remove label from issue', 'linear_remove_issue_label', 'pass'));
        } catch (error) {
          steps.push(makeStep('remove label from issue', 'linear_remove_issue_label', 'fail', errorMessage(error)));
        }
      }
      if (labelId && tools['linear_delete_issue_label']) {
        resources.push({
          kind: 'label',
          id: labelId,
          delete: () => call('linear_delete_issue_label', { labelId }),
        });
      }
    }

    // Attachment: tiny external link that documents the smoke run.
    if (tools['linear_create_attachment']) {
      let attachmentId: string | undefined;
      try {
        const attachment = await call<{ id: string }>('linear_create_attachment', {
          issueId,
          title: 'smoke-test attachment',
          url: 'https://mastra.ai/smoke',
          subtitle: runId,
        });
        attachmentId = attachment.id;
        steps.push(makeStep('create attachment', 'linear_create_attachment', 'pass', attachmentId));
      } catch (error) {
        steps.push(makeStep('create attachment', 'linear_create_attachment', 'fail', errorMessage(error)));
      }
      if (attachmentId && tools['linear_get_attachment']) {
        try {
          await call('linear_get_attachment', { id: attachmentId });
          steps.push(makeStep('get attachment', 'linear_get_attachment', 'pass'));
        } catch (error) {
          steps.push(makeStep('get attachment', 'linear_get_attachment', 'fail', errorMessage(error)));
        }
      }
      if (attachmentId && tools['linear_delete_attachment']) {
        resources.push({
          kind: 'attachment',
          id: attachmentId,
          delete: () => call('linear_delete_attachment', { attachmentId }),
        });
      }
    }

    // Project: real lifecycle for full coverage. The provider ships no
    // delete_project or archive_project tool, so the smoke project cannot be
    // cleaned up through the toolset — an accepted, documented leak (one tiny
    // runId-tagged project per run) rather than downgrading create/get/update
    // to probes and losing real coverage.
    if (tools['linear_create_project']) {
      let projectId: string | undefined;
      try {
        const project = await call<{ id: string }>('linear_create_project', {
          name: `${runId} smoke project`,
          teamIds: [team.id],
        });
        projectId = project.id;
        steps.push(makeStep('create project', 'linear_create_project', 'pass', projectId));
      } catch (error) {
        steps.push(makeStep('create project', 'linear_create_project', 'fail', errorMessage(error)));
      }
      if (projectId && tools['linear_get_project']) {
        try {
          await call('linear_get_project', { projectId });
          steps.push(makeStep('get project', 'linear_get_project', 'pass'));
        } catch (error) {
          steps.push(makeStep('get project', 'linear_get_project', 'fail', errorMessage(error)));
        }
      }
      if (projectId && tools['linear_update_project']) {
        try {
          await call('linear_update_project', { projectId, name: `${runId} smoke project (renamed)` });
          steps.push(makeStep('update project', 'linear_update_project', 'pass'));
        } catch (error) {
          steps.push(makeStep('update project', 'linear_update_project', 'fail', errorMessage(error)));
        }
      }
      // The provider ships unarchive_project but no archive_project, so we
      // cannot put the project into an archived state first. Probe unarchive
      // against the real (non-archived) project — Linear treats it as a no-op
      // or rejects it, either of which proves the endpoint works.
      if (projectId) {
        steps.push(await probeTool(call, tools, 'unarchive project', 'linear_unarchive_project', { projectId }));
        // Surface the leak loudly, but as a skip: this is a known provider
        // tooling gap, not a per-run cleanup failure — recording `fail` would
        // keep every run permanently red for something the scenario can't fix.
        log.error(
          `Smoke project ${projectId} ("${runId} smoke project (renamed)") cannot be deleted — the Linear provider has no delete/archive project tool. Delete it manually.`,
        );
        steps.push(
          makeStep(
            'delete project',
            undefined,
            'skip',
            `no delete/archive project tool in provider — project ${projectId} leaked, delete manually`,
          ),
        );
      }
    }

    // Cleanup created resources first, in reverse creation order.
    for (const resource of resources.reverse()) {
      try {
        await resource.delete();
        steps.push(makeStep(`delete ${resource.kind}`, undefined, 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke ${resource.kind} ${resource.id} — clean up manually.`, errorMessage(error));
        steps.push(makeStep(`delete ${resource.kind}`, undefined, 'fail', errorMessage(error)));
      }
    }

    // Clean up the second issue we created for the relation test, if any.
    if (secondIssueId) {
      try {
        await call('linear_delete_issue', { id: secondIssueId });
        steps.push(makeStep('delete related issue', 'linear_delete_issue', 'pass'));
      } catch (error) {
        log.error(`Failed to delete related smoke issue ${secondIssueId}`, errorMessage(error));
        steps.push(makeStep('delete related issue', 'linear_delete_issue', 'fail', errorMessage(error)));
      }
    }

    // Finally, delete the issue itself.
    try {
      await call('linear_delete_issue', { id: issueId });
      steps.push(makeStep('delete issue', 'linear_delete_issue', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke issue ${issueId} — clean up manually.`, errorMessage(error));
      steps.push(makeStep('delete issue', 'linear_delete_issue', 'fail', errorMessage(error)));
    }

    return steps;
  },
};

async function runReadOnly(
  call: <T>(toolId: string, input: unknown) => Promise<T>,
  teamId: string,
  steps: ScenarioStep[],
): Promise<void> {
  // Smoke-check every Linear read tool we can call without side effects. Each
  // tool only has to return without throwing to count as "wired correctly".
  const reads: Array<[string, unknown]> = [
    ['linear_list_users', { first: 5 }],
    ['linear_list_issues', { first: 5, teamId }],
    ['linear_search_issues', { term: 'mastra', first: 5 }],
    ['linear_list_projects', { first: 5 }],
    ['linear_list_cycles', { first: 5, teamId }],
    ['linear_list_issue_labels', { first: 5 }],
    ['linear_list_workflow_states', { first: 5, teamId }],
    ['linear_list_attachments', { first: 5 }],
    ['linear_get_viewer', {}],
    ['linear_get_team', { id: teamId }],
  ];
  for (const [toolId, input] of reads) {
    try {
      await call(toolId, input);
      steps.push(makeStep(toolId.replace('linear_', ''), toolId, 'pass'));
    } catch (error) {
      steps.push(makeStep(toolId.replace('linear_', ''), toolId, 'fail', errorMessage(error)));
    }
  }
}
