import { describe, expect, it } from 'vitest';
import { BoardWrites } from '../../boards/board-writes.js';
import { createIntegrationBoardSetup } from '../../boards/integration-board-setup.js';
import { ProjectBoardCache } from '../../boards/project-boards.js';
import { createBoardRegistry } from '../../boards/registry.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import type { PlatformAlertEvent } from '../../rules/types.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { ALERT_TRIAGE_PHASE_KEY, ALERT_TRIAGE_ROUTE, setUpAlertTriage } from './board.js';
import { ALERT_INTEGRATION_ID, PlatformAlertRules } from './rules.js';

const T0 = Date.parse('2026-11-13T10:00:00Z');

function opened(incidentId: string): PlatformAlertEvent {
  return {
    eventId: `${incidentId}:opened`,
    type: 'alert.opened',
    occurredAt: new Date(T0).toISOString(),
    organizationId: 'org-1',
    incident: {
      id: incidentId,
      fingerprint: 'fp-1',
      eventType: 'observability.rule',
      severity: 'error',
      openedAt: new Date(T0).toISOString(),
      resolvedAt: null,
      eventCount: 1,
    },
    workKey: { kind: 'rule', ruleId: 'rule-1' },
    projectId: 'platform-project-1',
    region: 'us',
    summary: 'Agent error rate above 5%',
  };
}

async function harness() {
  const seeded = await createFactoryStorageForTests();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'acme/app' } });
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  const projectBoards = new ProjectBoardCache({
    codeRegistry: createBoardRegistry(),
    storage: seeded.boards,
    projects: seeded.projects,
    warn: () => {},
  });
  const audits: string[] = [];
  const boardSetup = createIntegrationBoardSetup({
    writes: new BoardWrites({ storage: seeded.boards, boards: projectBoards, workItems: seeded.workItems }),
    boards: projectBoards,
    storage: seeded.boards,
    audit: async (_scope, entry) => void audits.push(entry.action),
  });
  const work = async () => (await projectBoards.describe(scope)).registry.get('work')!;
  const routes = async () => (await seeded.boards.listIntakeRoutes(scope)).map(route => route.name);
  return { seeded, project, scope, projectBoards, setup: boardSetup, audits, work, routes };
}

describe('alert triage on the Work board', () => {
  it('adds the phase and its route once, right after Intake, leaving the rest of the board as it was', async () => {
    const { setup, scope, audits, work, routes } = await harness();
    const before = Object.keys((await work()).phases);
    expect(before).not.toContain(ALERT_TRIAGE_PHASE_KEY);

    await setUpAlertTriage(setup, scope);
    const board = await work();
    const keys = Object.keys(board.phases);
    expect(keys.indexOf(ALERT_TRIAGE_PHASE_KEY)).toBe(keys.indexOf('intake') + 1);
    expect(board.phases.intake!.nextPhases).toContain(ALERT_TRIAGE_PHASE_KEY);
    // Every other phase is as it was.
    expect(keys.filter(key => key !== ALERT_TRIAGE_PHASE_KEY)).toEqual(before);
    const names = await routes();
    expect(names).toContain(ALERT_TRIAGE_ROUTE.name);
    // Ahead of the catch-all, which must stay last.
    expect(names.indexOf(ALERT_TRIAGE_ROUTE.name)).toBeLessThan(names.length - 1);
    expect(audits).toEqual(['factory.board.updated', 'factory.intake_route.created']);

    // A second bind adds nothing.
    await setUpAlertTriage(setup, scope);
    expect(audits).toEqual(['factory.board.updated', 'factory.intake_route.created']);
    expect((await routes()).filter(name => name === ALERT_TRIAGE_ROUTE.name)).toHaveLength(1);
  });

  it('files an alert card into Alert triage and starts its triage run with nobody approving', async () => {
    const { seeded, project, scope, setup, projectBoards } = await harness();
    await setUpAlertTriage(setup, scope);
    const boards = (await projectBoards.describe(scope)).registry;
    const rules = new PlatformAlertRules({
      projects: seeded.projects,
      storage: seeded.workItems,
      configVersion: 'factory-config-v1',
      boards,
      now: () => new Date(T0),
    });
    const dispatcher = new FactoryDecisionDispatcher({
      controller: {} as never,
      storage: seeded.workItems,
      boards,
      transitionService: new FactoryTransitionService({
        storage: seeded.workItems,
        boards,
        configVersion: 'factory-config-v1',
      }),
      intakeRoutes: seeded.boards,
      ownerId: 'alert-board-test',
    });

    await rules.ingest({ orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id, event: opened('i1') });
    await dispatcher.runOnce(new Date(T0 + 60_000));

    const [card] = (await seeded.workItems.list({ orgId: 'org-1', factoryProjectId: project.id })).filter(
      item => item.externalSource?.integrationId === ALERT_INTEGRATION_ID,
    );
    expect(card?.stages).toEqual([ALERT_TRIAGE_PHASE_KEY]);
    const runs = (await seeded.workItems.listDeferredDecisions('org-1', project.id)).filter(
      entry => entry.decision.type === 'invokeSkill',
    );
    expect(runs.map(entry => entry.decision)).toEqual([
      expect.objectContaining({ type: 'invokeSkill', skillName: 'alert-triage', role: 'work' }),
    ]);
  });

  it('adds one phase and one route when two replicas set the project up at once', async () => {
    const { setup, scope, work, routes, audits } = await harness();
    await Promise.all([setUpAlertTriage(setup, scope), setUpAlertTriage(setup, scope)]);
    expect(audits.filter(action => action === 'factory.intake_route.created')).toHaveLength(1);
    expect(Object.keys((await work()).phases).filter(key => key === ALERT_TRIAGE_PHASE_KEY)).toHaveLength(1);
    expect((await routes()).filter(name => name === ALERT_TRIAGE_ROUTE.name)).toHaveLength(1);
  });

  it('only starts on its own for alert cards', async () => {
    const { scope, setup, work } = await harness();
    await setUpAlertTriage(setup, scope);
    const board = await work();
    const facts = (integrationId: string) => ({ 'source.integration': integrationId });
    expect(board.startsAutomatically(ALERT_TRIAGE_PHASE_KEY, facts(ALERT_INTEGRATION_ID))).toBe(true);
    expect(board.startsAutomatically(ALERT_TRIAGE_PHASE_KEY, facts('github'))).toBe(false);
  });

  it('leaves a project without a Work Intake alone', async () => {
    const warnings: string[] = [];
    const scope = { orgId: 'org-1', factoryProjectId: 'gone' };
    await setUpAlertTriage({ addPhase: async () => 'no_board', addIntakeRoute: async () => 'added' }, scope, {
      warn: message => void warnings.push(message),
    });
    expect(warnings).toHaveLength(1);
  });
});
