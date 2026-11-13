import type { VersionControl } from '../../../capabilities/version-control.js';
import type { PlatformConnectIntegration } from '../foundation/integration.js';
import { PlatformVersionControlCapability } from '../foundation/version-control.js';

/** The repository operations Platform GitHub implements on top of the shared capability. */
export type PlatformGithubRepositoryOperations = Omit<
  VersionControl,
  'initialize' | 'registerInstallation' | 'registerRepositories' | 'resolveReviewThread'
> &
  Required<Pick<VersionControl, 'getRepositoriesAccess' | 'publishCommitCheck'>>;

/**
 * Platform GitHub's version control: installation and repository mirroring
 * and credential access come from {@link PlatformVersionControlCapability};
 * repository operations are the integration's, which choose a transport by
 * the org's mode.
 */
export class PlatformGithubVersionControl extends PlatformVersionControlCapability implements VersionControl {
  readonly #ops: PlatformGithubRepositoryOperations;

  constructor(integration: PlatformConnectIntegration, operations: PlatformGithubRepositoryOperations) {
    super(integration);
    this.#ops = operations;
  }

  getRepositoryTarget: VersionControl['getRepositoryTarget'] = input => this.#ops.getRepositoryTarget(input);
  getRepositoryAccess: VersionControl['getRepositoryAccess'] = input => this.#ops.getRepositoryAccess(input);
  getRepositoriesAccess: PlatformGithubRepositoryOperations['getRepositoriesAccess'] = input =>
    this.#ops.getRepositoriesAccess(input);
  listPullRequests: VersionControl['listPullRequests'] = input => this.#ops.listPullRequests(input);
  getPullRequest: VersionControl['getPullRequest'] = input => this.#ops.getPullRequest(input);
  createPullRequest: VersionControl['createPullRequest'] = input => this.#ops.createPullRequest(input);
  updatePullRequest: VersionControl['updatePullRequest'] = input => this.#ops.updatePullRequest(input);
  closePullRequest: VersionControl['closePullRequest'] = input => this.#ops.closePullRequest(input);
  mergePullRequest: VersionControl['mergePullRequest'] = input => this.#ops.mergePullRequest(input);
  listComments: VersionControl['listComments'] = input => this.#ops.listComments(input);
  createComment: VersionControl['createComment'] = input => this.#ops.createComment(input);
  updateComment: VersionControl['updateComment'] = input => this.#ops.updateComment(input);
  deleteComment: VersionControl['deleteComment'] = input => this.#ops.deleteComment(input);
  listReviews: VersionControl['listReviews'] = input => this.#ops.listReviews(input);
  getReview: VersionControl['getReview'] = input => this.#ops.getReview(input);
  createReview: VersionControl['createReview'] = input => this.#ops.createReview(input);
  updateReview: VersionControl['updateReview'] = input => this.#ops.updateReview(input);
  submitReview: VersionControl['submitReview'] = input => this.#ops.submitReview(input);
  dismissReview: VersionControl['dismissReview'] = input => this.#ops.dismissReview(input);
  deletePendingReview: VersionControl['deletePendingReview'] = input => this.#ops.deletePendingReview(input);
  listReviewComments: VersionControl['listReviewComments'] = input => this.#ops.listReviewComments(input);
  createReviewComment: VersionControl['createReviewComment'] = input => this.#ops.createReviewComment(input);
  updateReviewComment: VersionControl['updateReviewComment'] = input => this.#ops.updateReviewComment(input);
  deleteReviewComment: VersionControl['deleteReviewComment'] = input => this.#ops.deleteReviewComment(input);
  listRequestedReviewers: VersionControl['listRequestedReviewers'] = input => this.#ops.listRequestedReviewers(input);
  requestReviewers: VersionControl['requestReviewers'] = input => this.#ops.requestReviewers(input);
  removeRequestedReviewers: VersionControl['removeRequestedReviewers'] = input =>
    this.#ops.removeRequestedReviewers(input);
  publishCommitCheck: PlatformGithubRepositoryOperations['publishCommitCheck'] = input =>
    this.#ops.publishCommitCheck(input);
}
