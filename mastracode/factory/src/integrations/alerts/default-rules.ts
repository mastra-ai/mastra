import type {
  FactoryPlatformAlertEventName,
  FactoryPlatformAlertRuleContext,
  FactoryRuleHandler,
} from '../../rules/types.js';

export type PlatformAlertEventRules = Readonly<
  Record<FactoryPlatformAlertEventName, FactoryRuleHandler<FactoryPlatformAlertRuleContext> | null>
>;

/** Labels every alert card carries, so a project's intake routes can match alerts like any labeled issue. */
export function alertLabels(alert: FactoryPlatformAlertRuleContext['alert']): string[] {
  return ['alert', `severity:${alert.incident.severity}`, ...(alert.rule ? [`rule:${alert.rule.name}`] : [])];
}

function alertDescription(context: FactoryPlatformAlertRuleContext): string {
  const { alert } = context;
  const facts = [
    `**Alert:** ${alert.summary}`,
    alert.rule && `**Rule:** ${alert.rule.name} — ${alert.rule.conditionSummary}`,
    `**Severity:** ${alert.incident.severity}`,
    alert.projectId && `**Platform project:** \`${alert.projectId}\` (${alert.region.toUpperCase()})`,
    alert.environmentName && `**Environment:** ${alert.environmentName}`,
    alert.repo && `**Repository:** ${alert.repo.owner}/${alert.repo.name}`,
    `**Incident:** \`${alert.incident.id}\` opened ${alert.incident.openedAt}`,
    alert.rule?.url && `**Details:** ${alert.rule.url}`,
    context.previousCardId && `**Previous card:** ${context.previousCardId}`,
  ].filter((fact): fact is string => typeof fact === 'string' && fact.length > 0);
  return [
    facts.map(fact => `- ${fact}`).join('\n'),
    "Diagnose with the `alert-triage` skill: read this incident's traces and logs with the alert read tools, then open a fix PR for review. Never merge it.",
  ].join('\n\n');
}

/** A first fire files a card on the intake phase; the project's intake routes decide what happens next. */
function alertOpened(context: FactoryPlatformAlertRuleContext) {
  if (context.item || !context.intake) return;
  const { alert } = context;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:alert-intake`,
    board: context.intake.board,
    source: 'platform-alert',
    sourceKey: context.sourceKey,
    title: alert.rule ? `Alert: ${alert.rule.name}` : `Alert: ${alert.summary}`,
    description: alertDescription(context),
    url: alert.rule?.url || null,
    stage: context.intake.initialPhase,
    metadata: {
      identifier: alert.rule?.name ?? alert.summary,
      author: 'mastra-alerts',
      labels: alertLabels(alert),
      severity: alert.incident.severity,
      platformProjectId: alert.projectId,
      region: alert.region,
      createdAt: alert.incident.openedAt,
      updatedAt: alert.occurredAt,
    },
  } as const;
}

/**
 * Only a first fire has a default rule. Re-fires, recoveries, severity changes and thread links only
 * update the card's alert activity; a card that fires again after it was finished is reopened through
 * the project's `work_item.reopened` route.
 */
export const defaultPlatformAlertRules = Object.freeze({
  alertOpened,
  alertRefired: null,
  alertSeverityRaised: null,
  alertResolved: null,
  alertThreadLinked: null,
} satisfies PlatformAlertEventRules);
