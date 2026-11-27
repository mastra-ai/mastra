import { useAgentVersions } from '@mastra/react/hooks/agents';
import { useState } from 'react';
import { toVersionModel } from './experiment-trigger-options';

/**
 * Which stored version of an agent an experiment runs on. One query, shared by the version field and the
 * model picker: a pinned version brings its own model, so the picker must show that model instead of the
 * agent's own, or it would claim a model the run does not use.
 */
export function useAgentVersionChoice({ agentId, initialVersion }: { agentId?: string; initialVersion?: string }) {
  const [version, setVersion] = useState(initialVersion);
  const { data, isLoading } = useAgentVersions({
    agentId,
    params: { orderBy: { direction: 'DESC' } },
    queryOptions: { enabled: Boolean(agentId) },
  });

  const versions = data?.versions ?? [];
  // A pinned version outside the first page keeps the pin (the run still uses it) but has no model to show.
  const selectedVersion = versions.find(candidate => candidate.id === version);

  return {
    /** The pinned version id, or undefined to run the agent's latest version. */
    version,
    setVersion,
    versions,
    isLoading,
    /** The model a pinned version was saved with, or undefined when nothing is pinned. */
    selectedVersionModel: toVersionModel(selectedVersion),
    reset: () => setVersion(undefined),
  };
}
