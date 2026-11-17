/**
 * Read with the installation token that already clones and pushes, not through
 * `getInstallationOctokit`: the Platform deployment answers that with a
 * pull-request-only stub, so `repos.*` is undefined there at runtime while the
 * cast keeps the compiler quiet.
 */

import type { VersionControl } from '../../capabilities/version-control.js';

const GITHUB_API = 'https://api.github.com';

const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

const SHA_PATTERN = /^[0-9a-f]{40}$/;

const CREATE_COMMIT_ON_BRANCH = `
  mutation FactoryCreateCommitOnBranch($input: CreateCommitOnBranchInput!) {
    createCommitOnBranch(input: $input) {
      commit {
        oid
      }
    }
  }
`;

/**
 * Raised when the signed-commit mutation fails. `ambiguous` is true when the
 * request may have reached GitHub but the outcome is unknown — a transport
 * error, an aborted request, or a 5xx — so the caller must re-read the branch
 * head before deciding whether anything landed.
 */
export class SignedCommitError extends Error {
  constructor(
    message: string,
    readonly ambiguous: boolean,
  ) {
    super(message);
    this.name = 'SignedCommitError';
  }
}

export interface CreateCommitOnBranchRequest {
  /** Repository full name, `owner/name`. */
  repository: string;
  /** Branch to advance; it must already exist on the remote. */
  branch: string;
  /** Full sha the branch must currently point at (GitHub rejects the write otherwise). */
  expectedHeadSha: string;
  /** Commit subject line. */
  headline: string;
  /** Optional commit body; original `Co-authored-by` trailers belong here. */
  body?: string;
  /** Files to add or overwrite, with base64 contents. */
  additions?: { path: string; contents: string }[];
  /** Paths to remove. */
  deletions?: { path: string }[];
}

/**
 * Publish one commit with GitHub's server-side signing (`createCommitOnBranch`),
 * using the installation token that already clones and pushes. Talks to GraphQL
 * over `fetch` rather than through `getInstallationOctokit`, for the same reason
 * as {@link getBranchHead}: the Platform deployment answers the Octokit factory
 * with a pull-request-only stub whose REST namespaces are undefined here.
 *
 * The mutation can only add and delete files, so the caller must have proved
 * every change in the commit is expressible that way before calling.
 */
export async function createCommitOnBranch(
  access: { token: string },
  input: CreateCommitOnBranchRequest,
): Promise<{ sha: string }> {
  const response = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${access.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: CREATE_COMMIT_ON_BRANCH,
      variables: {
        input: {
          branch: { repositoryNameWithOwner: input.repository, branchName: input.branch },
          expectedHeadOid: input.expectedHeadSha,
          message: {
            headline: input.headline,
            ...(input.body ? { body: input.body } : {}),
          },
          fileChanges: {
            ...(input.additions?.length ? { additions: input.additions } : {}),
            ...(input.deletions?.length ? { deletions: input.deletions } : {}),
          },
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => {
    throw new SignedCommitError(
      `GitHub did not answer the signed commit request for ${input.repository}@${input.branch}.`,
      true,
    );
  });

  if (!response.ok) {
    // A 5xx may have been applied before failing, so the caller must re-read the
    // branch head; a 4xx is a definite rejection.
    throw new SignedCommitError(
      `GitHub rejected the signed commit for ${input.repository}@${input.branch} (${response.status}).`,
      response.status >= 500,
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: { createCommitOnBranch?: { commit?: { oid?: string } } | null };
    errors?: { message?: string }[];
  } | null;

  if (payload?.errors?.length) {
    const detail = payload.errors.map(entry => entry.message).filter(Boolean).join('; ') || 'unknown GraphQL error';
    throw new SignedCommitError(
      `GitHub rejected the signed commit for ${input.repository}@${input.branch}: ${detail}.`,
      false,
    );
  }

  const oid = payload?.data?.createCommitOnBranch?.commit?.oid;
  if (!oid || !SHA_PATTERN.test(oid)) {
    throw new SignedCommitError(`GitHub returned no commit sha for ${input.repository}@${input.branch}.`, true);
  }
  return { sha: oid };
}

/**
 * The commit a branch points at right now, or `null` when GitHub says the branch
 * does not exist. Signed publication asks this before planning a rewrite, so
 * "no branch yet" is an answer it can act on rather than a failure.
 */
export async function getBranchHeadOrNull(
  github: { versionControl: Pick<VersionControl, 'getRepositoryAccess'> },
  input: { orgId: string; repository: { id: string; slug: string }; branch: string },
): Promise<string | null> {
  const access = await github.versionControl.getRepositoryAccess({
    orgId: input.orgId,
    repositoryId: input.repository.id,
  });

  const response = await fetch(
    `${GITHUB_API}/repos/${input.repository.slug}/commits/${encodeURIComponent(input.branch)}`,
    {
      headers: {
        accept: 'application/vnd.github.sha',
        ...(access.authorization ? { authorization: `Bearer ${access.authorization.token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`GitHub rejected the head lookup for ${input.repository.slug}@${input.branch} (${response.status}).`);
  }

  const sha = (await response.text()).trim();
  if (!SHA_PATTERN.test(sha)) {
    throw new Error(`GitHub returned no commit sha for ${input.repository.slug}@${input.branch}.`);
  }
  return sha;
}

/** The commit a branch points at right now, as a full sha. Throws when GitHub rejects the lookup. */
export async function getBranchHead(
  github: { versionControl: Pick<VersionControl, 'getRepositoryAccess'> },
  input: { orgId: string; repository: { id: string; slug: string }; branch: string },
): Promise<string> {
  const sha = await getBranchHeadOrNull(github, input);
  if (sha === null) {
    throw new Error(`GitHub rejected the head lookup for ${input.repository.slug}@${input.branch} (404).`);
  }
  return sha;
}
