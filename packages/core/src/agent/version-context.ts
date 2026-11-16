import type { VersionOverrides } from '../mastra/types';
import { MASTRA_VERSIONS_KEY, mergeVersionOverrides } from '../request-context';
import type { RequestContext } from '../request-context';

export function resolveVersionContext(
  requestContext: RequestContext,
  requestVersions: VersionOverrides | undefined,
  defaultVersions: VersionOverrides | undefined,
  callVersions: VersionOverrides | undefined,
): VersionOverrides | undefined {
  let versions = mergeVersionOverrides(defaultVersions, requestVersions);
  if (callVersions) {
    versions = mergeVersionOverrides(versions, callVersions);
  }
  if (versions) {
    requestContext.set(MASTRA_VERSIONS_KEY, versions);
  }
  return versions;
}
