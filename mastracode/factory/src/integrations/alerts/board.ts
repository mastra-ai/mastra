import type { IntegrationBoardSetup } from '../../boards/integration-board-setup.js';
import type { StoredBoardScope, StoredIntakeRouteInput, StoredPhaseInput } from '../../storage/domains/boards/base.js';
import { ALERT_INTEGRATION_ID } from './rules.js';

export const ALERT_TRIAGE_PHASE_KEY = 'alert-triage';
/** The session context triage runs in: Work's, so a fix it hands to Building keeps its findings. */
export const ALERT_TRIAGE_CONTEXT = 'work';

const IS_ALERT = {
  operator: 'AND' as const,
  conditions: [{ field: 'source.integration', operator: 'equals' as const, value: ALERT_INTEGRATION_ID }],
};

/**
 * Work's phase for a Mastra Alerts card: it starts the `alert-triage` run on its own for alert
 * cards only, which reads the incident, posts a diagnosis and opens a fix for review.
 */
export const ALERT_TRIAGE_PHASE: StoredPhaseInput = {
  key: ALERT_TRIAGE_PHASE_KEY,
  name: 'Alert triage',
  description: 'Mastra Alerts cards: diagnose the incident and open a fix for review.',
  kind: 'working',
  runner: { skill: 'alert-triage', context: ALERT_TRIAGE_CONTEXT },
  autoStart: true,
  autoStartWhen: IS_ALERT,
  // Review for the fix's pull request; Planning when the fix needs a plan; Intake when no fix is right.
  nextPhases: ['pr-review', 'planning', 'intake', 'done', 'canceled'],
};

/** New Mastra Alerts cards go to Work › Alert triage, ahead of the route taking every new card. */
export const ALERT_TRIAGE_ROUTE: StoredIntakeRouteInput = {
  name: 'Mastra Alerts cards go to Work › Alert triage',
  on: ['work_item.opened'],
  when: IS_ALERT,
  target: { boardKey: 'work', phaseKey: ALERT_TRIAGE_PHASE_KEY },
};

/**
 * Gives a project bound to Mastra Alerts its triage phase and route. Both are the project's own
 * afterwards: an admin who turns off the phase's auto-start, edits it or retargets the route keeps
 * that choice; binding the project again only adds what is missing. A project without Work keeps
 * its alerts in whatever its routes choose.
 */
export async function setUpAlertTriage(
  setup: IntegrationBoardSetup,
  scope: StoredBoardScope,
  logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void },
): Promise<void> {
  const phase = await setup.addPhase(scope, {
    boardKey: 'work',
    phase: ALERT_TRIAGE_PHASE,
    after: 'intake',
    reachableFrom: ['intake'],
  });
  if (phase === 'no_board') {
    logger?.warn('Mastra Alerts: the project has no Work board with Intake; alerts go where its routes send them', {
      factoryProjectId: scope.factoryProjectId,
    });
    return;
  }
  await setup.addIntakeRoute(scope, ALERT_TRIAGE_ROUTE);
}
