/**
 * Which commit each environment repository pins to.
 *
 * The repo templates key `resolveHead` by clone URL; the factory records heads
 * by repository slug. These helpers translate between the two and decide
 * whether a set of current heads differs from the recorded one.
 */

import type { VersionControl } from '../capabilities/version-control.js';
import { getBranchHead } from '../integrations/github/commits.js';

export type EnvironmentHeads = Record<string, string>;

/** `owner/repo` from a clone URL in any common spelling, lower-cased, `.git` stripped; undefined when unparseable. */
export function cloneUrlSlug(cloneUrl: string): string | undefined {
  let path: string;
  const scp = /^[^@/]+@[^:/]+:(.+)$/.exec(cloneUrl.trim());
  if (scp) {
    path = scp[1]!;
  } else {
    try {
      path = new URL(cloneUrl.trim()).pathname;
    } catch {
      return undefined;
    }
  }
  const parts = path
    .replace(/\.git$/i, '')
    .split('/')
    .filter(Boolean);
  if (parts.length < 2) return undefined;
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`.toLowerCase();
}

/** The environment slug a clone URL names, in the environment's own spelling; undefined when none matches. */
export function matchEnvironmentSlug(cloneUrl: string, slugs: Iterable<string>): string | undefined {
  const wanted = cloneUrlSlug(cloneUrl);
  if (!wanted) return undefined;
  for (const slug of slugs) {
    if (slug.toLowerCase() === wanted) return slug;
  }
  return undefined;
}

/**
 * A `resolveHead` that answers from recorded heads only: the template pins to
 * what the last build used, so its identity moves when a build does. A URL
 * outside the recorded set resolves undefined and the template falls back to
 * its own lookup for that repository.
 */
export function recordedHeadResolver(heads: EnvironmentHeads): (cloneUrl: string) => Promise<string | undefined> {
  const slugs = Object.keys(heads);
  return async cloneUrl => {
    const slug = matchEnvironmentSlug(cloneUrl, slugs);
    return slug ? heads[slug] : undefined;
  };
}

/** True when any repository's current head differs from the recorded one, or either side names a repository the other lacks. */
export function headsChanged(recorded: EnvironmentHeads | null, current: EnvironmentHeads): boolean {
  if (!recorded) return true;
  const recordedKeys = Object.keys(recorded);
  const currentKeys = Object.keys(current);
  if (recordedKeys.length !== currentKeys.length) return true;
  return currentKeys.some(slug => recorded[slug] !== current[slug]);
}

export interface HeadRepository {
  id: string;
  slug: string;
  /** The ref the environment pins: the link's branch, else the repository default. */
  branch: string;
}

/** Current head of every repository's pinned ref, keyed by slug. Throws when any lookup fails. */
export async function resolveCurrentHeads(
  github: { versionControl: Pick<VersionControl, 'getRepositoryAccess'> },
  input: { orgId: string; repositories: HeadRepository[] },
): Promise<EnvironmentHeads> {
  const heads: EnvironmentHeads = {};
  for (const repository of input.repositories) {
    heads[repository.slug] = await getBranchHead(github, {
      orgId: input.orgId,
      repository: { id: repository.id, slug: repository.slug },
      branch: repository.branch,
    });
  }
  return heads;
}
