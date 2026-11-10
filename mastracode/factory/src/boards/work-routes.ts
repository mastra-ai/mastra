import type { StoredIntakeRouteInput } from '../storage/domains/boards/base.js';

// The routes every project starts with. Work is the default board, so they name its phases;
// they are stored routes like any other, which admins edit, retarget or delete.

/**
 * The route every project starts with: a GitHub or GitLab card whose author is outside the
 * write-access circle lands in Work › Intake, where nothing starts until a person moves it.
 * It is a stored route like any other, so admins can see, edit, disable or delete it.
 */
export const DEFAULT_INTAKE_ROUTE: StoredIntakeRouteInput = {
  name: 'Outside authors wait in Intake',
  when: {
    operator: 'AND',
    conditions: [
      { field: 'source.integration', operator: 'in', value: ['github', 'gitlab'] },
      { field: 'author.trusted', operator: 'equals', value: false },
    ],
  },
  target: { boardKey: 'work', phaseKey: 'intake' },
};

/**
 * Pull requests are reviewed in Work › Review. It comes after `DEFAULT_INTAKE_ROUTE`, so a
 * pull request from outside the write-access circle still waits in Intake for a person.
 */
export const PULL_REQUEST_INTAKE_ROUTE: StoredIntakeRouteInput = {
  name: 'Pull requests go to Review',
  when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] },
  target: { boardKey: 'work', phaseKey: 'pr-review' },
};

/** A Work card whose issue was closed as done goes to Done. */
export const CLOSED_COMPLETED_ROUTE: StoredIntakeRouteInput = {
  name: 'Closed issues go to Done',
  on: ['work_item.closed'],
  when: { operator: 'AND', conditions: [{ field: 'event.reason', operator: 'equals', value: 'completed' }] },
  target: { boardKey: 'work', phaseKey: 'done' },
};

/** A Work card whose issue was closed as not planned, or as a duplicate, goes to Canceled. */
export const CLOSED_CANCELED_ROUTE: StoredIntakeRouteInput = {
  name: 'Issues closed as not planned go to Canceled',
  on: ['work_item.closed'],
  when: { operator: 'AND', conditions: [{ field: 'event.reason', operator: 'equals', value: 'canceled' }] },
  target: { boardKey: 'work', phaseKey: 'canceled' },
};

/** A finished Work card whose issue was reopened goes back to Intake, where a person picks it up again. */
export const REOPENED_ROUTE: StoredIntakeRouteInput = {
  name: 'Reopened issues go back to Intake',
  on: ['work_item.reopened'],
  target: { boardKey: 'work', phaseKey: 'intake' },
};

/**
 * A merged pull request finishes its Work card: the pull request's own card, or the issue card
 * whose session opened it (unless that card still has another pull request out).
 */
export const PULL_REQUEST_MERGED_ROUTE: StoredIntakeRouteInput = {
  name: 'Merged pull requests go to Done',
  on: ['pull_request.merged'],
  target: { boardKey: 'work', phaseKey: 'done' },
};

/** A pull request's own Work card goes to Canceled when the pull request is closed unmerged. */
export const PULL_REQUEST_CLOSED_ROUTE: StoredIntakeRouteInput = {
  name: 'Pull requests closed unmerged go to Canceled',
  on: ['pull_request.closed'],
  when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] },
  target: { boardKey: 'work', phaseKey: 'canceled' },
};

/**
 * An issue card in Review whose last open pull request was closed unmerged goes back to
 * Intake: the issue is still open.
 */
export const PULL_REQUEST_CLOSED_ISSUE_ROUTE: StoredIntakeRouteInput = {
  name: 'Issues whose pull request closed unmerged go back to Intake',
  on: ['pull_request.closed'],
  when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'not_equals', value: 'pull_request' }] },
  target: { boardKey: 'work', phaseKey: 'intake' },
};

/** A push to a pull request in review restarts its review in Review. */
export const PULL_REQUEST_UPDATED_ROUTE: StoredIntakeRouteInput = {
  name: 'Pushes to a reviewed pull request re-review it',
  on: ['pull_request.synchronized'],
  target: { boardKey: 'work', phaseKey: 'pr-review' },
};

/** A maintainer asking Factory to review a pull request again sends it to Review. */
export const PULL_REQUEST_REVIEW_REQUESTED_ROUTE: StoredIntakeRouteInput = {
  name: 'Requested reviews go to Review',
  on: ['pull_request.review_requested'],
  target: { boardKey: 'work', phaseKey: 'pr-review' },
};

/**
 * A pull request from someone with write access that closes an issue nobody has started work on
 * joins that issue's card, which goes to Review. Once the issue has left Intake, the pull request
 * gets its own card in Review instead; projects can widen the phases. Its condition stands on its
 * own, so it is tried first.
 */
export const CLOSES_ISSUE_INTAKE_ROUTE: StoredIntakeRouteInput = {
  name: 'Pull requests that close a waiting issue join its card',
  when: {
    operator: 'AND',
    conditions: [
      { field: 'source.kind', operator: 'equals', value: 'pull_request' },
      { field: 'author.trusted', operator: 'equals', value: true },
      { field: 'pullRequest.closesIssue', operator: 'equals', value: true },
      { field: 'closedIssue.phase', operator: 'in', value: ['intake'] },
      { field: 'closedIssue.hasPullRequest', operator: 'equals', value: false },
    ],
  },
  target: { boardKey: 'work', phaseKey: 'pr-review', joinClosedIssue: true },
};

/**
 * Every new card no route before it placed lands in Work › Intake. It is the project's default
 * board as a stored route: point it at another board to send new cards there instead.
 */
export const CATCH_ALL_INTAKE_ROUTE: StoredIntakeRouteInput = {
  name: 'Everything else goes to Work › Intake',
  when: null,
  target: { boardKey: 'work', phaseKey: 'intake' },
};

/**
 * The routes Factory adds to a project, in order, each under a key that never changes. A project
 * gets each one once: a new project gets them all, a project set up earlier gets a route added
 * since at the end of its list (or at the start, for a `first` one), and a route an admin deleted
 * stays deleted. The catch-all stays last: a default added after it would never place a new card.
 */
export const DEFAULT_INTAKE_ROUTES: readonly { key: string; route: StoredIntakeRouteInput; first?: true }[] = [
  { key: 'closes-issue', route: CLOSES_ISSUE_INTAKE_ROUTE, first: true },
  { key: 'outside-authors', route: DEFAULT_INTAKE_ROUTE },
  { key: 'pull-requests', route: PULL_REQUEST_INTAKE_ROUTE },
  { key: 'closed-completed', route: CLOSED_COMPLETED_ROUTE },
  { key: 'closed-canceled', route: CLOSED_CANCELED_ROUTE },
  { key: 'reopened', route: REOPENED_ROUTE },
  { key: 'pull-request-merged', route: PULL_REQUEST_MERGED_ROUTE },
  { key: 'pull-request-closed', route: PULL_REQUEST_CLOSED_ROUTE },
  { key: 'pull-request-closed-issue', route: PULL_REQUEST_CLOSED_ISSUE_ROUTE },
  { key: 'pull-request-updated', route: PULL_REQUEST_UPDATED_ROUTE },
  { key: 'pull-request-review-requested', route: PULL_REQUEST_REVIEW_REQUESTED_ROUTE },
  { key: 'everything-else', route: CATCH_ALL_INTAKE_ROUTE },
];
