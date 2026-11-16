import { closedByRoutes } from '../../rules/event-rules.js';
import type {
  FactoryDependabotEventName,
  FactoryDependabotRuleContext,
  FactoryRuleHandler,
} from '../../rules/types.js';

export type DependabotEventRules = Readonly<
  Record<FactoryDependabotEventName, FactoryRuleHandler<FactoryDependabotRuleContext> | null>
>;

const CLOSED_STATES = new Set(['dismissed', 'fixed', 'auto_dismissed']);

export function isClosedDependabotState(state: string): boolean {
  return CLOSED_STATES.has(state);
}

function dependabotAlertObserved(context: FactoryDependabotRuleContext) {
  if (context.item || !context.intake) return;
  const { alert } = context;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:alert-intake`,
    // Filed on the default board's first phase; the project's intake routes place it from there.
    board: context.intake.board,
    source: 'github-dependabot-alert',
    sourceKey: alert.id,
    title: alert.title,
    ...(alert.description ? { description: alert.description } : {}),
    url: alert.url,
    stage: context.intake.initialPhase,
    metadata: {
      identifier: `${alert.repository}#dependabot-${alert.number}`,
      repository: alert.repository,
      number: alert.number,
      state: alert.state,
      severity: alert.severity,
      packageName: alert.packageName,
      ecosystem: alert.ecosystem,
      manifestPath: alert.manifestPath,
      ghsaId: alert.ghsaId,
      cveId: alert.cveId,
      author: 'dependabot',
      labels: [...alert.labels] as string[],
      sourceCreatedAt: alert.createdAt,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    },
  } as const;
}

function dependabotAlertClosed(context: FactoryDependabotRuleContext) {
  if (!context.item || context.item.source !== 'github-dependabot-alert') return;
  const closure = context.boardClosure;
  if (!context.board || !closure || closure.itemTerminal) return;
  if (!isClosedDependabotState(context.alert.state)) return;
  // A fix completes the card; any dismissal cancels it.
  const canceled = context.alert.state !== 'fixed';
  const target = canceled ? closure.canceled : closure.completed;
  return closedByRoutes(canceled, {
    idempotencyKey: `${context.ingress.id}:alert-closed`,
    board: context.board,
    stage: target.phase,
    message: {
      text: `Dependabot alert ${context.alert.repository}#${context.alert.number} was ${context.alert.state.replace('_', ' ')}; this ${closure.boardTitle} card was moved to ${target.title}.`,
    },
  });
}

export const defaultDependabotRules = Object.freeze({
  alertObserved: dependabotAlertObserved,
  alertClosed: dependabotAlertClosed,
} satisfies DependabotEventRules);
