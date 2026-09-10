/**
 * GitLab webhook payload → Factory rule event.
 *
 * Parsing lives apart from the rules engine and the integration class so the
 * mapping from GitLab's `object_kind`/`action` vocabulary onto
 * `FACTORY_GITLAB_EVENTS` is unit-testable against raw payloads, with no
 * storage, routes, or client involved.
 */
import type { FactoryGitlabEventName } from '../../rules/types.js';
import { formatIssueRef } from './client.js';

/** Kinds Factory acts on. Anything else is acknowledged and dropped. */
const SUPPORTED_OBJECT_KINDS = new Set(['issue', 'note', 'merge_request']);

export interface ParsedGitlabWebhook {
  event: FactoryGitlabEventName;
  deliveryId: string;
  project: { id: number; pathWithNamespace: string };
  mergeRequest?: {
    iid: number;
    ref: string;
    title: string;
    url: string;
    state: 'open' | 'closed';
    merged: boolean;
    draft: boolean;
    headBranch: string;
    baseBranch: string;
    author: string | null;
    assignees?: readonly string[];
    reviewers?: readonly string[];
    labels?: readonly string[];
    createdAt?: string;
    updatedAt?: string;
    headChanged: boolean;
  };
  mergeRequestNote?: {
    id: number;
    body: string;
    url?: string;
    author?: string;
    createdAt?: string;
  };
  issue?: {
    iid: number;
    ref: string;
    title: string;
    url: string;
    state: 'opened' | 'closed';
    stateType: string;
    author: string | null;
    assignees?: readonly string[];
    labels?: readonly string[];
    createdAt?: string;
    updatedAt?: string;
  };
  issueNote?: {
    id: number;
    body: string;
    url?: string;
    author?: string;
    createdAt?: string;
  };
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  // GitLab sends ids as numbers, but self-hosted proxies have been seen to
  // stringify them; accept a numeric string rather than dropping the delivery.
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const names = value
    .map(entry => str(entry) ?? str(object(entry)?.['title']) ?? str(object(entry)?.['username']))
    .filter((entry): entry is string => entry !== undefined);
  return names.length > 0 ? names : undefined;
}

/**
 * `issue` deliveries carry an `action`; GitLab's are `open`, `update`, `close`,
 * and `reopen`. A reopen is an open — it puts the issue back in the state a new
 * issue arrives in, and the rule that handles it is upsert-shaped either way.
 */
function issueEvent(action: string | undefined): FactoryGitlabEventName | undefined {
  switch (action) {
    case 'open':
    case 'reopen':
      return 'issueOpened';
    case 'update':
      return 'issueEdited';
    case 'close':
      return 'issueClosed';
    default:
      return undefined;
  }
}

/**
 * GitLab's merge-request actions. `open` and `reopen` both put the MR in the
 * state a new one arrives in. `merge` and `close` are distinct outcomes —
 * merged work is finished, closed work was abandoned — so they map to separate
 * events rather than one "no longer open".
 *
 * `approved`/`unapproved` and `approval`/`unapproval` are deliberately dropped:
 * an approval is a verdict on a review Factory did not necessarily run, and
 * acting on it would move cards a reviewer never asked to move.
 */
function mergeRequestEvent(action: string | undefined, merged: boolean): FactoryGitlabEventName | undefined {
  switch (action) {
    case 'open':
    case 'reopen':
      return 'mergeRequestOpened';
    case 'update':
      return 'mergeRequestUpdated';
    case 'merge':
      return 'mergeRequestMerged';
    case 'close':
      return 'mergeRequestClosed';
    default:
      // GitLab has shipped deliveries whose `action` is absent but whose state
      // already reads `merged`; treating that as a merge is truer than dropping
      // the one delivery that retires the card.
      return merged ? 'mergeRequestMerged' : undefined;
  }
}

/**
 * Parse a delivery body into the one event it maps to, or `null` when Factory
 * has no rule for it.
 *
 * Returning `null` rather than throwing is deliberate: GitLab retries a
 * non-2xx delivery, so rejecting a merge-request or pipeline hook would turn an
 * unremarkable "not for us" into a retry loop.
 */
export function parseGitlabWebhook(body: unknown): ParsedGitlabWebhook | null {
  const payload = object(body);
  const kind = str(payload?.['object_kind']);
  if (!payload || !kind || !SUPPORTED_OBJECT_KINDS.has(kind)) return null;

  const project = object(payload['project']);
  const projectId = num(project?.['id']) ?? num(payload['project_id']);
  const projectPath = str(project?.['path_with_namespace']);
  if (projectId === undefined || !projectPath) return null;

  const attributes = object(payload['object_attributes']);
  if (!attributes) return null;

  // A `note` delivery carries the thing it is attached to alongside it, so
  // `noteable_type` decides whether this is an issue comment or an MR comment.
  const noteableType = kind === 'note' ? str(attributes['noteable_type']) : undefined;
  const isMergeRequest = kind === 'merge_request' || noteableType === 'MergeRequest';

  if (isMergeRequest) {
    const mrSource = kind === 'note' ? object(payload['merge_request']) : attributes;
    if (!mrSource) return null;

    const iid = num(mrSource['iid']);
    const title = str(mrSource['title']);
    const headBranch = str(mrSource['source_branch']);
    const baseBranch = str(mrSource['target_branch']);
    if (iid === undefined || !title || !headBranch || !baseBranch) return null;

    const rawState = str(mrSource['state']);
    const merged = rawState === 'merged';
    const event = kind === 'note' ? 'mergeRequestNoteCreated' : mergeRequestEvent(str(attributes['action']), merged);
    if (!event) return null;

    const updatedAt = str(mrSource['updated_at']);
    const mrUrl = str(mrSource['url']) ?? str(mrSource['web_url']) ?? `${projectPath}!${iid}`;
    const noteId = kind === 'note' ? (num(attributes['id']) ?? 0) : undefined;
    const noteAuthor = str(object(payload['user'])?.['username']);

    const note =
      kind === 'note'
        ? {
            id: noteId ?? 0,
            body: str(attributes['note']) ?? '',
            ...(str(attributes['url']) ? { url: str(attributes['url'])! } : {}),
            ...(noteAuthor ? { author: noteAuthor } : {}),
            ...(str(attributes['created_at']) ? { createdAt: str(attributes['created_at'])! } : {}),
          }
        : undefined;

    return {
      event,
      deliveryId: note
        ? `gitlab:mr-note:${note.id}`
        : `gitlab:merge-request:${projectId}!${iid}:${event}:${updatedAt ?? 'unknown'}`,
      project: { id: projectId, pathWithNamespace: projectPath },
      mergeRequest: {
        iid,
        ref: formatIssueRef({ projectId: String(projectId), iid }),
        title,
        url: mrUrl,
        // `locked` is a transient lock during merge, not a lifecycle state: an
        // MR is open until it is merged or closed.
        state: rawState === 'closed' ? 'closed' : 'open',
        merged,
        draft: mrSource['draft'] === true || mrSource['work_in_progress'] === true,
        headBranch,
        baseBranch,
        author: noteAuthor ?? null,
        // GitLab sets `oldrev` only when the head moved, which is the only way
        // to tell a push from a title edit inside one `update` action.
        headChanged: str(attributes['oldrev']) !== undefined,
        ...(strings(mrSource['assignees']) ? { assignees: strings(mrSource['assignees'])! } : {}),
        ...(strings(mrSource['reviewers']) ? { reviewers: strings(mrSource['reviewers'])! } : {}),
        ...(strings(payload['labels']) ?? strings(mrSource['labels'])
          ? { labels: (strings(payload['labels']) ?? strings(mrSource['labels']))! }
          : {}),
        ...(str(mrSource['created_at']) ? { createdAt: str(mrSource['created_at'])! } : {}),
        ...(updatedAt ? { updatedAt } : {}),
      },
      ...(note ? { mergeRequestNote: note } : {}),
    };
  }

  // An `issue` delivery describes the issue in `object_attributes`; a `note`
  // describes the note there and the issue alongside it.
  const issueSource = kind === 'note' ? object(payload['issue']) : attributes;
  if (!issueSource) return null;

  if (kind === 'note' && noteableType !== 'Issue') return null;

  const iid = num(issueSource['iid']);
  const title = str(issueSource['title']);
  if (iid === undefined || !title) return null;

  const event = kind === 'note' ? 'issueNoteCreated' : issueEvent(str(attributes['action']));
  if (!event) return null;

  const state = str(issueSource['state']) === 'closed' ? 'closed' : 'opened';
  const updatedAt = str(issueSource['updated_at']);
  const issueUrl = str(issueSource['url']) ?? str(issueSource['web_url']) ?? `${projectPath}#${iid}`;

  const note =
    kind === 'note'
      ? {
          id: num(attributes['id']) ?? 0,
          body: str(attributes['note']) ?? '',
          ...(str(attributes['url']) ? { url: str(attributes['url'])! } : {}),
          ...(str(object(payload['user'])?.['username'])
            ? { author: str(object(payload['user'])?.['username'])! }
            : {}),
          ...(str(attributes['created_at']) ? { createdAt: str(attributes['created_at'])! } : {}),
        }
      : undefined;

  return {
    event,
    // GitLab sends no delivery id, and the ingress identity is what dedupes, so
    // it has to separate distinct changes while still collapsing a redelivery
    // of the same one.
    //
    // The event is part of the key because `updated_at` has second precision:
    // an edit and a close landing in the same second would otherwise look like
    // one delivery, and the close — the transition that retires the card —
    // would be dropped as a replay. A note is keyed by its own id, since two
    // notes can also share the issue's `updated_at`.
    deliveryId: note ? `gitlab:note:${note.id}` : `gitlab:issue:${projectId}!${iid}:${event}:${updatedAt ?? 'unknown'}`,
    project: { id: projectId, pathWithNamespace: projectPath },
    issue: {
      iid,
      ref: formatIssueRef({ projectId: String(projectId), iid }),
      title,
      url: issueUrl,
      state,
      stateType: state === 'closed' ? 'completed' : 'unstarted',
      author: str(object(payload['user'])?.['username']) ?? null,
      ...(strings(issueSource['assignees']) ? { assignees: strings(issueSource['assignees'])! } : {}),
      ...(strings(issueSource['labels']) ? { labels: strings(issueSource['labels'])! } : {}),
      ...(str(issueSource['created_at']) ? { createdAt: str(issueSource['created_at'])! } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    },
    ...(note ? { issueNote: note } : {}),
  };
}
