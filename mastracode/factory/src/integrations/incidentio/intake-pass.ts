import type { Intake, IntakeItem } from '../../capabilities/intake.js';
import type { IntegrationContext } from '../base.js';
import { boundIntakeSources, createIntakePass } from '../intake-pass.js';
import type { IntakePass, IntakeRecord } from '../intake-pass.js';
import type { IncidentioEventRules } from './default-rules.js';
import { attachIncidentioRules } from './rules.js';
import type { IncidentioIssueIngress } from './rules.js';

export const INCIDENTIO_FOLLOW_UP_PREFIX = 'incidentio:follow-up:';

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** A listed follow-up as the routes and the rules name it. Incidents are not intake and map to `null`. */
export function incidentioFollowUpIngress(
  item: IntakeItem,
): (IncidentioIssueIngress & { sourceId: string | null }) | null {
  const externalId = item.source.externalId;
  if (!externalId.startsWith(INCIDENTIO_FOLLOW_UP_PREFIX)) return null;
  const metadata = item.metadata ?? {};
  const identifier = text(metadata.identifier) ?? externalId;
  const titlePrefix = `${identifier}: `;
  return {
    id: externalId,
    identifier,
    title: item.title.startsWith(titlePrefix) ? item.title.slice(titlePrefix.length) : item.title,
    url: item.source.url ?? '',
    author: text(metadata.author),
    state: item.status ?? '',
    stateType: text(metadata.stateType) ?? '',
    priorityLabel: text(metadata.priority) ?? '',
    assignee: item.assignee ?? null,
    incident: text(metadata.incidentioIncidentId),
    labels: item.labels ?? [],
    createdAt: item.createdAt ?? '',
    updatedAt: item.updatedAt ?? '',
    sourceId: item.sourceId || null,
  };
}

/** The follow-up as Intake offers it: the facts its card would carry, so filing changes none of them. */
export function incidentioIntakeRecord(issue: IncidentioIssueIngress): IntakeRecord {
  const created = new Date(issue.createdAt);
  return {
    source: {
      integrationId: 'incidentio',
      type: 'issue',
      externalId: issue.id,
      ...(issue.url ? { url: issue.url } : {}),
    },
    title: issue.title,
    metadata: {
      identifier: issue.identifier,
      issueRef: issue.id,
      sourceCreatedAt: issue.createdAt,
      state: issue.state,
      stateType: issue.stateType,
      priority: issue.priorityLabel,
      incident: issue.incident,
      assignee: issue.assignee,
      assignees: issue.assignee ? [issue.assignee] : [],
      creator: issue.author,
      author: issue.author,
      labels: [...issue.labels],
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    },
    createdAt: Number.isNaN(created.getTime()) ? null : created,
  };
}

/**
 * Keeps the incident.io candidates of every project. incident.io sends the server no events, so
 * this pass is where a new follow-up is first seen.
 */
export function attachIncidentioIntakePass(
  incidentio: { intake: Pick<Intake, 'listItems'>; readonly rules: IncidentioEventRules },
  context: IntegrationContext,
): IntakePass | undefined {
  const ingest = attachIncidentioRules(incidentio, context);
  if (!context.runtime || !ingest) return undefined;
  return createIntakePass<IncidentioIssueIngress & { sourceId: string | null }>({
    integrationId: 'incidentio',
    kind: 'issue',
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    status: context.storage.generic.settings,
    offersNewlyListed: true,
    open: async orgId => {
      const bound = await boundIntakeSources(context.storage.intake, orgId, 'incidentio');
      return {
        sources: bound.forProject,
        list: async (_factoryProjectId, sourceIds, cursor) => {
          const page = await incidentio.intake.listItems({
            orgId,
            userId: 'factory-rule-dispatcher',
            sourceIds,
            ...(cursor ? { cursor } : {}),
          });
          return {
            items: page.items.flatMap(item => incidentioFollowUpIngress(item) ?? []),
            nextCursor: page.nextCursor,
          };
        },
      };
    },
    record: incidentioIntakeRecord,
    sourceId: issue => issue.sourceId,
    offer: ({ orgId, factoryProjectId }, issues) =>
      ingest({ orgId, userId: 'factory-rule-dispatcher', factoryProjectId, issues }),
  });
}
