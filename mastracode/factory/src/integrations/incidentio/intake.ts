import type { IntegrationConnection } from '../../capabilities/connection.js';
import type {
  GetIntakeIssueInput,
  Intake,
  IntakeIssue,
  IntakeIssueDetail,
  IntakeItemPage,
  ListIntakeIssuesInput,
  ListIntakeItemsInput,
  ResolveIntakeDispatchInput,
  ResolvedIntakeDispatch,
  UpdateIntakeIssueInput,
} from '../../capabilities/intake.js';
import {
  IncidentioApiClient,
  IncidentioApiError,
  type IncidentioActor,
  type IncidentioFollowUp,
  type IncidentioIncident,
} from './api.js';

export const INCIDENTIO_INCIDENTS_SOURCE_ID = 'incidentio:incidents';
export const INCIDENTIO_FOLLOW_UPS_SOURCE_ID = 'incidentio:follow-ups';

const INCIDENT_PREFIX = 'incidentio:incident:';
const FOLLOW_UP_PREFIX = 'incidentio:follow-up:';
const SOURCE_IDS = [INCIDENTIO_INCIDENTS_SOURCE_ID, INCIDENTIO_FOLLOW_UPS_SOURCE_ID] as const;

type IncidentioItemReference = { type: 'incident' | 'follow-up'; id: string };
type IncidentioPageCursor = { sourceIndex: number; provider?: string };

export function createIncidentioIntake(config: {
  api: IncidentioApiClient;
  connection: IntegrationConnection;
}): Intake {
  const assertConnection = (connection: IntegrationConnection): void => {
    if (
      connection.type !== config.connection.type ||
      connection.type !== 'oauth' ||
      config.connection.type !== 'oauth' ||
      connection.accessToken !== config.connection.accessToken
    ) {
      throw new Error('incident.io Intake received a connection it did not create.');
    }
  };

  const listIssues = async ({ sourceIds, labels, cursor }: ListIntakeIssuesInput) => {
    const selectedSources = SOURCE_IDS.filter(sourceId => sourceIds.includes(sourceId));
    const decodedCursor = decodePageCursor(cursor);
    if (decodedCursor.sourceIndex >= selectedSources.length) return { issues: [], nextCursor: null };

    const sourceId = selectedSources[decodedCursor.sourceIndex]!;
    const page =
      sourceId === INCIDENTIO_INCIDENTS_SOURCE_ID
        ? await config.api.listIncidents(decodedCursor.provider)
        : await config.api.listFollowUps(decodedCursor.provider);
    const issues = page.items
      .map(item =>
        sourceId === INCIDENTIO_INCIDENTS_SOURCE_ID
          ? incidentToIntakeIssue(item as IncidentioIncident)
          : followUpToIntakeIssue(item as IncidentioFollowUp),
      )
      .filter(issue => isActive(issue.stateType) && matchesLabels(issue.labels, labels));
    const nextCursor = page.nextCursor
      ? encodePageCursor({ sourceIndex: decodedCursor.sourceIndex, provider: page.nextCursor })
      : decodedCursor.sourceIndex + 1 < selectedSources.length
        ? encodePageCursor({ sourceIndex: decodedCursor.sourceIndex + 1 })
        : null;
    return { issues, nextCursor };
  };

  const getIssue = async ({ connection, issueId }: GetIntakeIssueInput): Promise<IntakeIssueDetail | null> => {
    assertConnection(connection);
    const reference = decodeItemReference(issueId);
    if (!reference) return null;
    try {
      if (reference.type === 'incident') {
        const incident = await config.api.getIncident(reference.id);
        return { ...incidentToIntakeIssue(incident), description: incident.summary ?? null, comments: [] };
      }
      const followUp = await config.api.getFollowUp(reference.id);
      return { ...followUpToIntakeIssue(followUp), description: followUp.description ?? null, comments: [] };
    } catch (error) {
      if (error instanceof IncidentioApiError && error.status === 404) return null;
      throw error;
    }
  };

  return {
    resolveIntakeDispatch: (input: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null> => {
      if (input.externalSource.type !== 'issue') return Promise.resolve(null);
      const reference = decodeItemReference(input.externalSource.externalId);
      if (!reference) return Promise.resolve(null);
      return Promise.resolve({
        connection: config.connection,
        sourceId:
          reference.type === 'incident' ? INCIDENTIO_INCIDENTS_SOURCE_ID : INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
        issueId: input.externalSource.externalId,
      });
    },
    listSources: async () => [
      { id: INCIDENTIO_INCIDENTS_SOURCE_ID, name: 'Incidents', type: 'incident' },
      { id: INCIDENTIO_FOLLOW_UPS_SOURCE_ID, name: 'Incident follow-ups', type: 'follow-up' },
    ],
    listItems: async (input: ListIntakeItemsInput): Promise<IntakeItemPage> => {
      const page = await listIssues({
        connection: config.connection,
        sourceIds: input.sourceIds,
        ...(input.cursor ? { cursor: input.cursor } : {}),
      });
      return {
        items: page.issues.map(issue => ({
          source: { type: 'issue', externalId: issue.id, url: issue.url },
          sourceId: issue.id.startsWith(INCIDENT_PREFIX)
            ? INCIDENTIO_INCIDENTS_SOURCE_ID
            : INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
          title: `${issue.identifier}: ${issue.title}`,
          status: issue.state ?? undefined,
          labels: issue.labels,
          assignee: issue.assignee,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          metadata: { stateType: issue.stateType, priority: issue.priority, source: issue.source },
        })),
        nextCursor: page.nextCursor,
      };
    },
    listIssues: async input => {
      assertConnection(input.connection);
      return listIssues(input);
    },
    getIssue,
    createComment: async input => {
      assertConnection(input.connection);
      return null;
    },
    updateIssue: async (input: UpdateIntakeIssueInput): Promise<IntakeIssue | null> => {
      assertConnection(input.connection);
      const reference = decodeItemReference(input.issueId);
      if (!reference || reference.type !== 'follow-up') return null;
      let followUp: IncidentioFollowUp;
      try {
        followUp = await config.api.getFollowUp(reference.id);
      } catch (error) {
        if (error instanceof IncidentioApiError && error.status === 404) return null;
        throw error;
      }
      const status = followUpStatusForTarget(input);
      if (!status) return null;
      if (followUp.status === status) return followUpToIntakeIssue(followUp);
      return followUpToIntakeIssue(await config.api.updateFollowUp(followUp, status));
    },
  };
}

function incidentToIntakeIssue(incident: IncidentioIncident): IntakeIssue {
  const labels = [incident.severity?.name, incident.incident_type?.name, incident.mode].filter(
    (label): label is string => Boolean(label),
  );
  return {
    id: `${INCIDENT_PREFIX}${incident.id}`,
    identifier: incident.reference,
    title: incident.name,
    url:
      incident.permalink ??
      incident.slack_channel_url ??
      incident.postmortem_document_url ??
      `https://app.incident.io/incidents/${encodeURIComponent(incident.id)}`,
    author: actorName(incident.creator),
    state: incident.incident_status.name,
    stateType: incidentStateType(incident.incident_status.category),
    priority: incident.severity?.name ?? null,
    assignee: null,
    source: 'Incident',
    labels,
    commentCount: 0,
    createdAt: incident.created_at,
    updatedAt: incident.updated_at,
  };
}

function followUpToIntakeIssue(followUp: IncidentioFollowUp): IntakeIssue {
  const assignees = [followUp.assignee?.name, followUp.assignee_team?.name].filter(
    (assignee): assignee is string => Boolean(assignee),
  );
  return {
    id: `${FOLLOW_UP_PREFIX}${followUp.id}`,
    identifier: followUp.external_issue_reference?.issue_name ?? followUp.id,
    title: followUp.title,
    url:
      followUp.external_issue_reference?.issue_permalink ??
      `https://app.incident.io/incidents/${encodeURIComponent(followUp.incident_id)}`,
    author: actorName(followUp.creator),
    state: followUp.status,
    stateType: followUpStateType(followUp.status),
    priority: followUp.priority?.name ?? null,
    assignee: assignees[0] ?? null,
    assignees,
    source: 'Follow-up',
    labels: followUp.labels,
    commentCount: 0,
    createdAt: followUp.created_at,
    updatedAt: followUp.updated_at,
  };
}

function actorName(actor: IncidentioActor): string | null {
  return actor.user?.name ?? actor.api_key?.name ?? actor.workflow?.name ?? actor.alert?.title ?? null;
}

function incidentStateType(category: string): string | null {
  switch (category) {
    case 'triage':
      return 'unstarted';
    case 'declined':
    case 'canceled':
      return 'canceled';
    case 'merged':
    case 'closed':
      return 'completed';
    case 'live':
    case 'learning':
    case 'paused':
      return 'started';
    default:
      return null;
  }
}

function followUpStateType(status: IncidentioFollowUp['status']): string {
  switch (status) {
    case 'outstanding':
      return 'unstarted';
    case 'completed':
      return 'completed';
    case 'deleted':
    case 'not_doing':
      return 'canceled';
  }
}

function followUpStatusForTarget(input: UpdateIntakeIssueInput): IncidentioFollowUp['status'] | null {
  if (input.state.kind === 'byType') {
    switch (input.state.stateType) {
      case 'unstarted':
      case 'started':
        return 'outstanding';
      case 'completed':
        return 'completed';
      case 'canceled':
        return 'not_doing';
    }
  }
  const status = input.state.name.toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  return status === 'outstanding' || status === 'completed' || status === 'not_doing' ? status : null;
}

function isActive(stateType: string | null): boolean {
  return stateType !== 'completed' && stateType !== 'canceled';
}

function matchesLabels(issueLabels: string[], requestedLabels: string[] | undefined): boolean {
  if (!requestedLabels?.length) return true;
  const labels = new Set(issueLabels.map(label => label.toLowerCase()));
  return requestedLabels.every(label => labels.has(label.toLowerCase()));
}

function decodeItemReference(value: string): IncidentioItemReference | null {
  if (value.startsWith(INCIDENT_PREFIX)) return { type: 'incident', id: value.slice(INCIDENT_PREFIX.length) };
  if (value.startsWith(FOLLOW_UP_PREFIX)) return { type: 'follow-up', id: value.slice(FOLLOW_UP_PREFIX.length) };
  return null;
}

function encodePageCursor(cursor: IncidentioPageCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodePageCursor(cursor: string | undefined): IncidentioPageCursor {
  if (!cursor) return { sourceIndex: 0 };
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<IncidentioPageCursor>;
    if (!Number.isSafeInteger(parsed.sourceIndex) || (parsed.sourceIndex ?? -1) < 0) return { sourceIndex: 0 };
    return {
      sourceIndex: parsed.sourceIndex!,
      ...(typeof parsed.provider === 'string' && parsed.provider ? { provider: parsed.provider } : {}),
    };
  } catch {
    return { sourceIndex: 0 };
  }
}
