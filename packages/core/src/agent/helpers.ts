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

export function resolveRunId(runId: string | undefined, generateId?: () => string | undefined): string {
  return runId ?? generateId?.() ?? globalThis.crypto.randomUUID();
}

export function successfulAgentOutput<T extends { error?: unknown }>(output: T): T {
  if (output.error) {
    throw output.error;
  }
  return output;
}

export async function drainAgentOutput<T extends { error?: unknown }>(output: {
  getFullOutput(): Promise<T>;
}): Promise<T> {
  return successfulAgentOutput(await output.getFullOutput());
}
