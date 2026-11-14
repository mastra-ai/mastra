import type { StoredIntakeRouteInput } from '../storage/domains/boards/base.js';

// The routes every project starts with. Work is the default board, so they name its phases;
// they are stored routes like any other, which admins edit, retarget or delete.

/**
 * The route every project starts with: a GitHub or GitLab issue whose author is outside the
 * write-access circle lands in Work › Intake, where nothing starts until a person moves it.
 * It is a stored route like any other, so admins can see, edit, disable or delete it.
 */
export const DEFAULT_INTAKE_ROUTE: StoredIntakeRouteInput = {
  name: 'Outside authors wait in Intake',
  on: ['work_item.opened'],
  when: {
    operator: 'AND',
    conditions: [
      { field: 'source.integration', operator: 'in', value: ['github', 'gitlab'] },
      { field: 'item.trusted', operator: 'equals', value: false },
    ],
  },
  target: { boardKey: 'work', phaseKey: 'intake' },
};

/**
 * A GitHub or GitLab pull request with no card, from outside the write-access circle, waits in
 * Work › Intake for a person. It names `source.kind` so that, as a `pull_request.opened` card move,
 * it never sends an outside author's issue card back to Intake when its session opens a pull request.
 */
export const OUTSIDE_PULL_REQUEST_INTAKE_ROUTE: StoredIntakeRouteInput = {
  name: 'Pull requests from outside authors wait in Intake',
  on: ['pull_request.opened'],
  when: {
    operator: 'AND',
    conditions: [
      { field: 'source.integration', operator: 'in', value: ['github', 'gitlab'] },
      { field: 'source.kind', operator: 'equals', value: 'pull_request' },
      { field: 'author.trusted', operator: 'equals', value: false },
    ],
  },
  target: { boardKey: 'work', phaseKey: 'intake' },
};

/**
 * Pull requests with no card are reviewed in Work › Review. It comes after
 * `OUTSIDE_PULL_REQUEST_INTAKE_ROUTE`, so a pull request from outside the write-access circle
 * still waits in Intake. As a card move it sends an issue card whose pull request opens to Review,
 * where the pull request rules send it anyway.
 */
export const PULL_REQUEST_INTAKE_ROUTE: StoredIntakeRouteInput = {
  name: 'Pull requests go to Review',
  on: ['pull_request.opened'],
  when: null,
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
 * A trusted pull request that closes an issue nobody has started work on takes that issue's card
 * to Review. Factory links a pull request to the card of the issue it closes itself, whoever
 * opened it; this route only decides the move, from the card as it was before the pull request
 * joined. Once the issue has left Intake the card stays put; projects can widen the phases.
 */
export const LINKED_PULL_REQUEST_ROUTE: StoredIntakeRouteInput = {
  name: 'Trusted pull requests take a waiting issue to Review',
  on: ['pull_request.opened'],
  when: {
    operator: 'AND',
    conditions: [
      { field: 'pullRequest.trusted', operator: 'equals', value: true },
      { field: 'pullRequest.closesIssue', operator: 'equals', value: true },
      { field: 'closedIssue.phase', operator: 'in', value: ['intake'] },
      { field: 'closedIssue.hasPullRequest', operator: 'equals', value: false },
    ],
  },
  target: { boardKey: 'work', phaseKey: 'pr-review' },
};

/** The key `LINKED_PULL_REQUEST_ROUTE` is seeded under; seeding it retires the project's join routes. */
export const LINKED_PULL_REQUEST_ROUTE_KEY = 'linked-pull-request';

/**
 * Every new issue no route before it placed lands in Work › Intake (`PULL_REQUEST_INTAKE_ROUTE`
 * takes every pull request). It is the project's default board as a stored route: point it at
 * another board to send new issues there instead.
 */
export const CATCH_ALL_INTAKE_ROUTE: StoredIntakeRouteInput = {
  name: 'Everything else goes to Work › Intake',
  on: ['work_item.opened'],
  when: null,
  target: { boardKey: 'work', phaseKey: 'intake' },
};

/**
 * The routes Factory adds to a project, in order, each under a key that never changes. A project
 * gets each one once: a new project gets them all, a project set up earlier gets a route added
 * since at the end of its list (or at the start, for a `first` one), and a route an admin deleted
 * stays deleted. A `newProjectsOnly` one counts as added to a project set up earlier without being
 * added: its stored routes already decide what it would. The catch-all stays last: a default added
 * after it would never place a new card.
 */
export const DEFAULT_INTAKE_ROUTES: readonly {
  key: string;
  route: StoredIntakeRouteInput;
  first?: true;
  newProjectsOnly?: true;
}[] = [
  { key: 'outside-authors', route: DEFAULT_INTAKE_ROUTE },
  { key: 'outside-author-pull-requests', route: OUTSIDE_PULL_REQUEST_INTAKE_ROUTE, newProjectsOnly: true },
  { key: 'pull-requests', route: PULL_REQUEST_INTAKE_ROUTE },
  { key: 'closed-completed', route: CLOSED_COMPLETED_ROUTE },
  { key: 'closed-canceled', route: CLOSED_CANCELED_ROUTE },
  { key: 'reopened', route: REOPENED_ROUTE },
  { key: 'pull-request-merged', route: PULL_REQUEST_MERGED_ROUTE },
  { key: 'pull-request-closed', route: PULL_REQUEST_CLOSED_ROUTE },
  { key: 'pull-request-closed-issue', route: PULL_REQUEST_CLOSED_ISSUE_ROUTE },
  { key: 'pull-request-updated', route: PULL_REQUEST_UPDATED_ROUTE },
  { key: 'pull-request-review-requested', route: PULL_REQUEST_REVIEW_REQUESTED_ROUTE },
  { key: LINKED_PULL_REQUEST_ROUTE_KEY, route: LINKED_PULL_REQUEST_ROUTE },
  { key: 'everything-else', route: CATCH_ALL_INTAKE_ROUTE },
];
