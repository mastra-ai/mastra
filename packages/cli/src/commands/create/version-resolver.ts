import { execa } from 'execa';
import semver from 'semver';

export type ResolvedMastraVersions = Record<string, string>;

/**
 * Resolve the exact published version for each requested Mastra package via its
 * `dist-tags.<versionTag>` entry. Returns a complete map of exact versions only
 * when every package resolves successfully; otherwise returns `undefined`.
 *
 * The low-level resolver never logs — the calling boundary owns the fallback
 * warning.
 */
export async function resolveMastraPackageVersions(
  packageNames: string[],
  versionTag: string,
): Promise<ResolvedMastraVersions | undefined> {
  const uniqueNames = [...new Set(packageNames)].sort();
  if (uniqueNames.length === 0) return {};

  const resolved: ResolvedMastraVersions = {};

  for (const packageName of uniqueNames) {
    const result = await resolveSinglePackageVersion(packageName, versionTag);
    if (result === undefined) return undefined;
    resolved[packageName] = result;
  }

  return resolved;
}

const NPM_VIEW_TIMEOUT_MS = 15_000;

async function resolveSinglePackageVersion(packageName: string, versionTag: string): Promise<string | undefined> {
  let stdout: string;
  try {
    const { stdout: output } = await execa('npm', ['view', packageName, `dist-tags.${versionTag}`], {
      timeout: NPM_VIEW_TIMEOUT_MS,
    });
    stdout = output;
  } catch {
    return undefined;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return undefined;

  // Require exactly one non-empty output line.
  if (trimmed.includes('\n')) return undefined;

  // Require the raw value to equal its semver-normalized form. This rejects
  // tags (e.g. "latest"), ranges (e.g. "^1.2.3"), noncanonical forms (e.g.
  // "v1.2.3"), and invalid semver, while accepting valid prerelease versions.
  const normalized = semver.valid(trimmed);
  if (normalized === null || normalized !== trimmed) return undefined;

  return normalized;
}
