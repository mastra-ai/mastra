import type { Octokit } from '@octokit/rest';

/**
 * GitHub exposes review threads only through GraphQL, keyed by node id, while
 * Factory tools carry REST comment ids. These helpers bridge the two.
 */

const REVIEW_THREAD_PAGE_SIZE = 100;

const REVIEW_THREADS_QUERY = `
  query ($owner: String!, $repo: String!, $number: Int!, $cursor: String, $pageSize: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: $pageSize, after: $cursor) {
          nodes {
            id
            comments(first: $pageSize) {
              nodes { fullDatabaseId }
              pageInfo { hasNextPage endCursor }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

const REVIEW_THREAD_COMMENTS_QUERY = `
  query ($threadId: ID!, $cursor: String, $pageSize: Int!) {
    node(id: $threadId) {
      ... on PullRequestReviewThread {
        comments(first: $pageSize, after: $cursor) {
          nodes { fullDatabaseId }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

const RESOLVE_REVIEW_THREAD_MUTATION = `
  mutation ($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) { thread { id } }
  }
`;

const UNRESOLVE_REVIEW_THREAD_MUTATION = `
  mutation ($threadId: ID!) {
    unresolveReviewThread(input: { threadId: $threadId }) { thread { id } }
  }
`;

interface GraphqlPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface GraphqlReviewThreadComments {
  // GitHub serializes the BigInt scalar as a string.
  nodes: Array<{ fullDatabaseId: string | null } | null> | null;
  pageInfo: GraphqlPageInfo;
}

interface ReviewThreadsResponse {
  repository: {
    pullRequest: {
      reviewThreads: {
        nodes: Array<{ id: string; comments: GraphqlReviewThreadComments } | null> | null;
        pageInfo: GraphqlPageInfo;
      };
    } | null;
  } | null;
}

interface ReviewThreadCommentsResponse {
  node: { comments?: GraphqlReviewThreadComments } | null;
}

function containsComment(comments: GraphqlReviewThreadComments, commentId: number): boolean {
  const id = String(commentId);
  return (comments.nodes ?? []).some(comment => comment?.fullDatabaseId === id);
}

/**
 * GitHub exposes review threads only through GraphQL, keyed by node id, while
 * Factory tools carry REST comment ids. Walk every thread (and every comment of
 * long threads) until one holds the comment; replies match their own thread.
 */
async function findReviewThreadId(
  octokit: Octokit,
  parts: { owner: string; repo: string },
  pullNumber: number,
  commentId: number,
): Promise<string | null> {
  let cursor: string | null = null;
  do {
    const response: ReviewThreadsResponse = await octokit.graphql<ReviewThreadsResponse>(REVIEW_THREADS_QUERY, {
      ...parts,
      number: pullNumber,
      cursor,
      pageSize: REVIEW_THREAD_PAGE_SIZE,
    });
    const threads = response.repository?.pullRequest?.reviewThreads;
    if (!threads) return null;
    const threadNodes = (threads.nodes ?? []).filter(thread => thread !== null);
    const match = threadNodes.find(thread => containsComment(thread.comments, commentId));
    if (match) return match.id;
    // Only threads longer than one page can still hide the comment.
    for (const thread of threadNodes) {
      let comments = thread.comments;
      while (comments.pageInfo.hasNextPage) {
        const page: ReviewThreadCommentsResponse = await octokit.graphql<ReviewThreadCommentsResponse>(
          REVIEW_THREAD_COMMENTS_QUERY,
          { threadId: thread.id, cursor: comments.pageInfo.endCursor, pageSize: REVIEW_THREAD_PAGE_SIZE },
        );
        if (!page.node?.comments) break;
        comments = page.node.comments;
        if (containsComment(comments, commentId)) return thread.id;
      }
    }
    cursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : null;
  } while (cursor);
  return null;
}

/**
 * Resolves, or with `resolved: false` reopens, the review thread holding the
 * REST review comment `commentId` in `parts`.
 */
export async function resolveReviewThreadOfComment(
  octokit: Octokit,
  parts: { owner: string; repo: string },
  sourceId: string,
  commentId: number,
  resolved: boolean,
): Promise<void> {
  let pullRequestUrl: string;
  try {
    const { data } = await octokit.pulls.getReviewComment({ ...parts, comment_id: commentId });
    pullRequestUrl = data.pull_request_url;
  } catch (err) {
    if (isNotFoundError(err)) {
      throw new Error(
        `GitHub review comment ${commentId} was not found in ${sourceId}. List the pull request's diff comments and pass the id of one of them.`,
      );
    }
    throw err;
  }
  const pullNumber = Number(pullRequestUrl.slice(pullRequestUrl.lastIndexOf('/') + 1));
  if (!Number.isSafeInteger(pullNumber) || pullNumber <= 0) {
    throw new Error(`GitHub returned review comment ${commentId} without a pull request.`);
  }
  const threadId = await findReviewThreadId(octokit, parts, pullNumber, commentId);
  if (!threadId) {
    throw new Error(
      `GitHub review comment ${commentId} on pull request #${pullNumber} is not part of a published review thread, so there is no thread to resolve. Comments in a pending review join a thread once that review is submitted; submit the review first, or pass the id of a published diff comment.`,
    );
  }
  const mutation = resolved ? RESOLVE_REVIEW_THREAD_MUTATION : UNRESOLVE_REVIEW_THREAD_MUTATION;
  await octokit.graphql(mutation, { threadId });
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}
