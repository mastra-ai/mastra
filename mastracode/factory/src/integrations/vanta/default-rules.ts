import { closedByRoutes } from '../../rules/event-rules.js';
import type { FactoryRuleHandler, FactoryVantaEventName, FactoryVantaRuleContext } from '../../rules/types.js';

export type VantaEventRules = Readonly<
  Record<FactoryVantaEventName, FactoryRuleHandler<FactoryVantaRuleContext> | null>
>;

const MAX_DESCRIPTION_LENGTH = 8000;

function vantaDescription(vulnerability: FactoryVantaRuleContext['vulnerability']): string {
  const facts = [
    `**Vulnerability:** ${vulnerability.name}`,
    vulnerability.packageIdentifier && `**Package:** \`${vulnerability.packageIdentifier}\``,
    vulnerability.severity && `**Severity:** ${vulnerability.severity}`,
    vulnerability.fixable !== null && `**Fixable:** ${vulnerability.fixable ? 'yes' : 'no'}`,
    vulnerability.remediateBy && `**Remediate by:** ${vulnerability.remediateBy.slice(0, 10)}`,
    vulnerability.url && `**Details:** ${vulnerability.url}`,
  ].filter((fact): fact is string => typeof fact === 'string');
  const parts = [facts.map(fact => `- ${fact}`).join('\n'), vulnerability.description?.trim()].filter(Boolean);
  const text = parts.join('\n\n');
  return text.length <= MAX_DESCRIPTION_LENGTH ? text : `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`;
}

function vantaVulnerabilityObserved(context: FactoryVantaRuleContext) {
  if (context.item || !context.intake) return;
  const { vulnerability } = context;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:vulnerability-intake`,
    // Filed on the default board's first phase; the project's intake routes place it from there.
    board: context.intake.board,
    source: 'vanta-vulnerability',
    sourceKey: vulnerability.id,
    title: vulnerability.title,
    description: vantaDescription(vulnerability),
    url: vulnerability.url,
    stage: context.intake.initialPhase,
    metadata: {
      identifier: vulnerability.name,
      ...(vulnerability.description ? { body: vulnerability.description } : {}),
      state: vulnerability.state,
      severity: vulnerability.severity,
      packageIdentifier: vulnerability.packageIdentifier,
      fixable: vulnerability.fixable,
      remediateBy: vulnerability.remediateBy,
      author: 'vanta',
      labels: [...vulnerability.labels] as string[],
      sourceCreatedAt: vulnerability.createdAt,
      createdAt: vulnerability.createdAt,
      updatedAt: vulnerability.createdAt,
    },
  } as const;
}

function vantaVulnerabilityClosed(context: FactoryVantaRuleContext) {
  if (!context.item || context.item.source !== 'vanta-vulnerability') return;
  const closure = context.boardClosure;
  if (!context.board || !closure || closure.itemTerminal) return;
  return closedByRoutes(false, {
    idempotencyKey: `${context.ingress.id}:vulnerability-closed`,
    board: context.board,
    stage: closure.completed.phase,
    message: {
      text: `Vanta no longer lists ${context.vulnerability.name} as active; this ${closure.boardTitle} card was moved to ${closure.completed.title}.`,
    },
  });
}

export const defaultVantaRules = Object.freeze({
  vulnerabilityObserved: vantaVulnerabilityObserved,
  vulnerabilityClosed: vantaVulnerabilityClosed,
} satisfies VantaEventRules);
