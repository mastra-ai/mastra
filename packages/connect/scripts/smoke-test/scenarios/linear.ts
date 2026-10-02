import type { Scenario, ScenarioStep } from '../scenario.js';
import { requireTools } from '../scenario.js';

/**
 * Linear exposes clean CRUD: create an issue in the first available team,
 * read it back, rename it, then archive and delete it. Every tool call goes
 * through the public `tools()` resolver, so this exercises the proxy path
 * end-to-end for a representative provider.
 */
export const linearScenario: Scenario = {
  integrationId: 'linear',
  summary: 'create → read → update → delete issue',
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

    // Pick a team to put the issue on. The suite does not create teams because
    // Linear teams are heavyweight workspace artifacts; the project must have
    // at least one team the connected user can post to.
    const teams = await call<{ items: Array<{ id: string; name: string }> }>('linear_list_teams', { first: 10 });
    const team = teams.items?.[0];
    if (!team) {
      steps.push({
        name: 'pick team',
        toolId: 'linear_list_teams',
        status: 'skip',
        detail: 'No Linear teams visible to the connected user.',
      });
      return steps;
    }
    steps.push({ name: 'pick team', toolId: 'linear_list_teams', status: 'pass', detail: team.name });

    const title = `${runId} smoke issue`;

    let createdId: string | undefined;
    try {
      const created = await call<{ id: string; identifier?: string }>('linear_create_issue', {
        teamId: team.id,
        title,
        description: 'Automated @mastra/connect smoke test. Safe to ignore and delete.',
      });
      createdId = created.id;
      steps.push({
        name: 'create issue',
        toolId: 'linear_create_issue',
        status: 'pass',
        detail: created.identifier ?? created.id,
      });
    } catch (error) {
      steps.push({
        name: 'create issue',
        toolId: 'linear_create_issue',
        status: 'fail',
        detail: errorMessage(error),
      });
      return steps;
    }

    // From here on, every path must end with a delete attempt, so we keep the
    // issue id in scope and run subsequent steps inside try/catch blocks that
    // record outcomes without short-circuiting cleanup.
    try {
      const roundtrip = await call<{ id: string; title?: string }>('linear_get_issue', { id: createdId });
      const ok = roundtrip.title === title;
      steps.push({
        name: 'read back',
        toolId: 'linear_get_issue',
        status: ok ? 'pass' : 'fail',
        detail: ok ? undefined : `Expected title "${title}", got "${roundtrip.title ?? '<none>'}".`,
      });
    } catch (error) {
      steps.push({ name: 'read back', toolId: 'linear_get_issue', status: 'fail', detail: errorMessage(error) });
    }

    const renamed = `${title} (renamed)`;
    try {
      await call('linear_update_issue', { id: createdId, title: renamed });
      const after = await call<{ title?: string }>('linear_get_issue', { id: createdId });
      const ok = after.title === renamed;
      steps.push({
        name: 'update title',
        toolId: 'linear_update_issue',
        status: ok ? 'pass' : 'fail',
        detail: ok ? undefined : `Expected renamed title, got "${after.title ?? '<none>'}".`,
      });
    } catch (error) {
      steps.push({ name: 'update title', toolId: 'linear_update_issue', status: 'fail', detail: errorMessage(error) });
    }

    try {
      await call('linear_delete_issue', { id: createdId });
      steps.push({ name: 'delete issue', toolId: 'linear_delete_issue', status: 'pass' });
    } catch (error) {
      // A failed delete is a leaked record; log loudly so an operator can
      // clean up by hand instead of silently moving on.
      log.error(`Failed to delete smoke issue ${createdId} — clean up manually.`, errorMessage(error));
      steps.push({ name: 'delete issue', toolId: 'linear_delete_issue', status: 'fail', detail: errorMessage(error) });
    }

    return steps;
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
