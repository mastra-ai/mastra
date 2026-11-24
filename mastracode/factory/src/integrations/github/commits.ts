/**
 * Read with the installation token that already clones and pushes, not through
 * `getInstallationOctokit`: the Platform deployment answers that with a
 * pull-request-only stub, so `repos.*` is undefined there at runtime while the
 * cast keeps the compiler quiet.
 */

import type { VersionControl } from '../../capabilities/version-control.js';

const GITHUB_API = 'https://api.github.com';

const SHA_PATTERN = /^[0-9a-f]{40}$/;

/** The commit a branch points at right now, as a full sha. Throws when GitHub rejects the lookup. */
export async function getBranchHead(
  github: { versionControl: Pick<VersionControl, 'getRepositoryAccess'> },
  input: { orgId: string; repository: { id: string; slug: string }; branch: string },
): Promise<string> {
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

  if (!response.ok) {
    throw new Error(`GitHub rejected the head lookup for ${input.repository.slug}@${input.branch} (${response.status}).`);
  }

  const sha = (await response.text()).trim();
  if (!SHA_PATTERN.test(sha)) {
    throw new Error(`GitHub returned no commit sha for ${input.repository.slug}@${input.branch}.`);
  }
  return sha;
}
