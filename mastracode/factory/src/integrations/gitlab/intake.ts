/**
 * GitLab → Factory intake mapping.
 *
 * Kept separate from the integration class so the provider-neutral shapes the
 * board consumes (`IntakeIssue`, `IntakeItem`) are translated in exactly one
 * place, and so the mapping is unit-testable without constructing routes,
 * storage, or a client.
 */
import type {
  IntakeIssue,
  IntakeIssueDetail,
  IntakeIssueComment,
  IntakeItem,
  IntakeIssueTargetState,
} from '../../capabilities/intake.js';
import { formatIssueRef, type GitLabIssue, type GitLabNote } from './client.js';

/**
 * GitLab has two issue states (`opened`/`closed`) against the contract's four
 * workflow families. `opened` maps to `unstarted` rather than `started`
 * because GitLab carries no "in progress" signal — a board that wants one
 * should derive it from a label instead.
 */
function stateType(issue: GitLabIssue): 'unstarted' | 'completed' {
  return issue.state === 'closed' ? 'completed' : 'unstarted';
}

/** `group/project#7` when GitLab supplies it, else a synthesized fallback. */
function identifier(issue: GitLabIssue): string {
  return issue.references?.full ?? `${issue.project_id}#${issue.iid}`;
}

export function toIntakeIssue(issue: GitLabIssue): IntakeIssue {
  return {
    id: formatIssueRef({ projectId: String(issue.project_id), iid: issue.iid }),
    identifier: identifier(issue),
    title: issue.title,
    url: issue.web_url,
    author: issue.author?.username ?? null,
    state: issue.state,
    stateType: stateType(issue),
    // GitLab models urgency as labels, not a first-class field. Left null so the
    // board shows "no priority" rather than inventing one from label text.
    priority: null,
    assignee: issue.assignee?.username ?? null,
    assignees: issue.assignees?.map(user => user.username) ?? [],
    source: String(issue.project_id),
    labels: issue.labels,
    commentCount: issue.user_notes_count ?? null,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  };
}

export function toIntakeComment(note: GitLabNote): IntakeIssueComment {
  return {
    author: note.author?.username ?? null,
    body: note.body,
    createdAt: note.created_at,
  };
}

export function toIntakeIssueDetail(issue: GitLabIssue, notes: GitLabNote[]): IntakeIssueDetail {
  return {
    ...toIntakeIssue(issue),
    description: issue.description,
    comments: notes.map(toIntakeComment),
  };
}

export function toIntakeItem(issue: GitLabIssue): IntakeItem {
  return {
    source: {
      type: 'issue',
      externalId: formatIssueRef({ projectId: String(issue.project_id), iid: issue.iid }),
      url: issue.web_url,
    },
    sourceId: String(issue.project_id),
    title: `${identifier(issue)}: ${issue.title}`,
    status: issue.state,
    labels: issue.labels,
    assignee: issue.assignee?.username ?? null,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    metadata: {
      iid: issue.iid,
      stateType: stateType(issue),
      projectId: issue.project_id,
    },
  };
}

/**
 * Translate a target state into a GitLab `state_event`.
 *
 * Returns `null` for targets GitLab cannot express — `byName` (no custom
 * workflow states) and `started` (no in-progress state). `Intake.updateIssue`
 * treats `null` as "not applicable, nothing to do" rather than an error, which
 * is exactly the semantics we want here.
 */
export function toStateEvent(target: IntakeIssueTargetState): 'close' | 'reopen' | null {
  if (target.kind === 'byName') return null;
  switch (target.stateType) {
    case 'completed':
    case 'canceled':
      return 'close';
    case 'unstarted':
      return 'reopen';
    case 'started':
      return null;
  }
}
