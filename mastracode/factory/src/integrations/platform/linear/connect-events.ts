import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../../../storage/domains/work-items/base.js';
import type { LinearIssueIngress, LinearRulesIngress } from '../../linear/rules.js';
import type { PlatformConnectEventDelivery } from '../foundation/connect-events.js';
import { logPlatformWarn } from '../logging.js';

/** How many handled delivery keys are remembered to skip replays. */
const RECENT_KEYS_LIMIT = 1_000;

export type LinearConnectEventOutcome =
  /** The issue was handed to every project that tracks it (possibly none). */
  | 'dispatched'
  /** The platform could not verify the webhook: never acted on. */
  | 'unverified'
  /** The delivery was already handled. */
  | 'duplicate'
  /** Not an Issue event, or an Issue payload without the fields a card needs. */
  | 'ignored'
  /** The payload names another Linear workspace than the connection's. */
  | 'workspace_mismatch'
  /** The connection is not an active project connection. */
  | 'unknown_connection';

export interface LinearConnectEventDeps {
  /**
   * The Linear workspace a connection serves, or null when the project has no such active connection.
   * `resourceId` is the Factory project a resource-scoped connection belongs to, or null for an org-level one.
   */
  connectionWorkspace(connectionId: string): Promise<{ linearWorkspaceId: string; resourceId: string | null } | null>;
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  workItems: Pick<WorkItemsStorage, 'listShared' | 'copyLegacyCards'>;
  ingest(input: LinearRulesIngress): Promise<unknown>;
  /** Delivery keys already handled, newest last. */
  recentKeys: Set<string>;
  onUnverifiedDropped?(): void;
}

/**
 * Handles one Linear webhook from a connection's platform event log: the raw webhook body
 * of a migrated workspace, published by the platform after its HMAC check.
 *
 * An Issue event updates the issue's cards, but only in the `(org, project)`
 * pairs that already have a card for that issue. The workspace is shared
 * across the org's projects, so dispatching anywhere else would file the
 * issue in projects that never chose its source (a cross-tenant leak). The
 * first sighting of an issue comes from the reconcile's intake discovery,
 * which only lists sources a project bound.
 *
 * Dispatch stays inside the organization that owns the connection: the org of
 * a resource-scoped connection's project, or for an org-level connection the
 * deployment's only organization. Identifiers like ENG-42 repeat across
 * workspaces, so a card that only knows its identifier is matched there and
 * nowhere else. When the owner can't be told (an org-level connection in a
 * deployment serving several organizations), only cards that know the issue's
 * id are updated: that id names this one Linear issue.
 *
 * Throws when a project's ingest fails, so the event poller retries; ingest
 * is idempotent per issue revision, so projects that already succeeded are
 * not changed twice.
 */
export async function handleLinearConnectEvent(
  event: PlatformConnectEventDelivery,
  deps: LinearConnectEventDeps,
): Promise<LinearConnectEventOutcome> {
  if (event.unverified) {
    deps.onUnverifiedDropped?.();
    logPlatformWarn('Platform Linear dropped an unverified event.', {
      connectionId: event.connectionId,
      eventId: event.id,
    });
    return 'unverified';
  }
  // Stream entry ids repeat across connections' logs, so the key names the connection too.
  const key = `linear:${event.connectionId}:${event.dedupeKey}`;
  if (deps.recentKeys.has(key)) return 'duplicate';

  const body = webhookBody(event);
  if (!body || body.type !== 'Issue') return remember(deps.recentKeys, key, 'ignored');

  const workspace = await deps.connectionWorkspace(event.connectionId);
  if (!workspace) {
    logPlatformWarn('Platform Linear event names a connection the project does not list as active; skipped.', {
      connectionId: event.connectionId,
      eventId: event.id,
    });
    return 'unknown_connection';
  }
  if (body.organizationId !== null && body.organizationId !== workspace.linearWorkspaceId) {
    logPlatformWarn('Platform Linear event names another workspace than its connection; rejected.', {
      connectionId: event.connectionId,
      eventId: event.id,
      connectionWorkspaceId: workspace.linearWorkspaceId,
      payloadWorkspaceId: body.organizationId,
    });
    return 'workspace_mismatch';
  }

  const issue = parseIssue(body);
  if (!issue) {
    logPlatformWarn('Platform Linear Issue event has no usable issue payload; skipped.', {
      connectionId: event.connectionId,
      eventId: event.id,
    });
    return remember(deps.recentKeys, key, 'ignored');
  }

  const sourceKey = `linear:${issue.identifier}`;
  const projects = await deps.projects.listAll();
  const owner = connectionOwner(workspace.resourceId, projects);
  if (owner.kind === 'unknown_project') {
    logPlatformWarn(
      'Platform Linear event names a connection scoped to a Factory project this deployment lacks; skipped.',
      {
        connectionId: event.connectionId,
        eventId: event.id,
        resourceId: workspace.resourceId,
      },
    );
    return 'unknown_connection';
  }
  const failures: string[] = [];
  for (const project of projects) {
    const ownedByConnection = owner.kind === 'org' && owner.orgId === project.orgId;
    if (owner.kind === 'org' && !ownedByConnection) continue;
    try {
      // A finished card may still be only in the legacy table; copy it so the event finds it.
      await deps.workItems.copyLegacyCards({
        orgId: project.orgId,
        factoryProjectId: project.id,
        sources: [{ integrationId: 'linear', type: 'issue', externalId: sourceKey }],
      });
      const items = await deps.workItems.listShared({ orgId: project.orgId, factoryProjectId: project.id });
      const tracked = items.some(item => {
        if (item.externalSource?.integrationId !== 'linear' || item.externalSource.type !== 'issue') return false;
        // Identifiers like ENG-42 repeat across workspaces: a card that knows its issue's id must match it.
        const issueId = item.workItem.metadata?.linearIssueId;
        if (typeof issueId === 'string' && issueId.length > 0) return issueId === issue.id;
        // An org may connect several workspaces, so an identifier-only card must also be filed under this workspace.
        return (
          ownedByConnection &&
          item.externalSource.externalId === sourceKey &&
          workspaceUrlKey(item.externalSource.url) !== undefined &&
          workspaceUrlKey(item.externalSource.url) === workspaceUrlKey(issue.url)
        );
      });
      if (!tracked) continue;
      await deps.ingest({
        orgId: project.orgId,
        userId: 'linear-connect-events',
        factoryProjectId: project.id,
        issues: [issue],
      });
    } catch (error) {
      failures.push(`${project.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Linear issue ${issue.identifier} could not be applied to ${failures.join('; ')}`);
  }
  return remember(deps.recentKeys, key, 'dispatched');
}

type ConnectionOwner = { kind: 'org'; orgId: string } | { kind: 'ambiguous' } | { kind: 'unknown_project' };

/** The organization a connection's events belong to, as Vanta attributes its connections. */
function connectionOwner(
  resourceId: string | null,
  projects: ReadonlyArray<{ id: string; orgId: string }>,
): ConnectionOwner {
  if (resourceId) {
    const project = projects.find(candidate => candidate.id === resourceId);
    return project ? { kind: 'org', orgId: project.orgId } : { kind: 'unknown_project' };
  }
  const orgIds = new Set(projects.map(project => project.orgId));
  return orgIds.size === 1 ? { kind: 'org', orgId: [...orgIds][0]! } : { kind: 'ambiguous' };
}

function remember(keys: Set<string>, key: string, outcome: LinearConnectEventOutcome): LinearConnectEventOutcome {
  keys.add(key);
  if (keys.size > RECENT_KEYS_LIMIT) keys.delete(keys.values().next().value!);
  return outcome;
}

interface LinearWebhookBody {
  type: string;
  organizationId: string | null;
  url: string | null;
  createdAt: string | null;
  data: Record<string, unknown> | undefined;
}

/** The fields of Linear's raw webhook body this handler reads. */
function webhookBody(event: PlatformConnectEventDelivery): LinearWebhookBody | null {
  if (event.payloadParseError) return null;
  const raw = optionalObject(event.payload);
  if (!raw || typeof raw.type !== 'string') return null;
  return {
    type: raw.type,
    organizationId: typeof raw.organizationId === 'string' ? raw.organizationId : null,
    url: typeof raw.url === 'string' ? raw.url : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
    data: optionalObject(raw.data),
  };
}

/** The rules ingress for an Issue webhook, or undefined when it lacks the fields a card needs. */
function parseIssue(body: LinearWebhookBody): LinearIssueIngress | undefined {
  const raw = body.data;
  if (!raw) return undefined;
  const id = typeof raw.id === 'string' ? raw.id : undefined;
  const identifier = typeof raw.identifier === 'string' ? raw.identifier : undefined;
  const title = typeof raw.title === 'string' ? raw.title : undefined;
  const url = typeof raw.url === 'string' ? raw.url : (body.url ?? undefined);
  if (!id || !identifier || !title || !url) return undefined;

  const state = optionalObject(raw.state);
  const team = optionalObject(raw.team);
  const assignee = optionalObject(raw.assignee);
  const creator = optionalObject(raw.user) ?? optionalObject(raw.creator);
  const labels = Array.isArray(raw.labels)
    ? raw.labels.flatMap(label => {
        const obj = optionalObject(label);
        return obj && typeof obj.name === 'string' ? [obj.name] : [];
      })
    : [];
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : (body.createdAt ?? '');
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;

  return {
    id,
    identifier,
    title,
    url,
    state: state && typeof state.name === 'string' ? state.name : '',
    stateType: state && typeof state.type === 'string' ? state.type : '',
    priorityLabel: typeof raw.priorityLabel === 'string' ? raw.priorityLabel : '',
    assignee: assignee && typeof assignee.name === 'string' ? assignee.name : null,
    creator: creator && typeof creator.name === 'string' ? creator.name : null,
    team: team && typeof team.name === 'string' ? team.name : null,
    labels,
    createdAt,
    updatedAt,
  };
}

/** The workspace segment of a Linear issue URL (`https://linear.app/<workspace>/issue/ENG-42`). */
function workspaceUrlKey(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const [workspace, kind] = parsed.pathname.split('/').filter(Boolean);
    return parsed.hostname === 'linear.app' && workspace && kind === 'issue' ? workspace : undefined;
  } catch {
    return undefined;
  }
}

function optionalObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}
