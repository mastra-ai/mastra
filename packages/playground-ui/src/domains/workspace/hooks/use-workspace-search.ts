import type { SkillSearchResult } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface WorkspaceSearchHit {
  kind: 'file' | 'skill';
  path: string;
  label: string;
  score: number;
}

// Chunked files are indexed as `<path>#chunk-<n>`.
const filePathFromId = (id: string) => id.replace(/#chunk-\d+$/, '');

const basename = (path: string) => path.split('/').filter(Boolean).pop() ?? path;

// The server returns `skillPath`, which the client type does not declare yet.
const skillFilePath = (result: SkillSearchResult & { skillPath?: string }) =>
  result.skillPath ? `${result.skillPath.replace(/\/$/, '')}/SKILL.md` : result.source;

/** Searches files and skills in parallel; one failing source (e.g. 501 not configured) keeps the other's hits. */
export function useWorkspaceSearch(workspaceId: string, query: string) {
  const client = useMastraClient();
  const trimmed = query.trim();

  return useQuery({
    queryKey: ['workspace', workspaceId, 'search', trimmed],
    queryFn: async () => {
      const workspace = client.getWorkspace(workspaceId);
      const [files, skills] = await Promise.allSettled([
        workspace.search({ query: trimmed }),
        workspace.searchSkills({ query: trimmed }),
      ]);

      if (files.status === 'rejected' && skills.status === 'rejected') throw files.reason;

      const hits = new Map<string, WorkspaceSearchHit>();
      const add = (hit: WorkspaceSearchHit) => {
        const existing = hits.get(hit.path);
        if (!existing || existing.score < hit.score) hits.set(hit.path, hit);
      };

      if (files.status === 'fulfilled') {
        for (const result of files.value.results) {
          const path = filePathFromId(result.id);
          add({ kind: 'file', path, label: basename(path), score: result.score });
        }
      }
      if (skills.status === 'fulfilled') {
        for (const result of skills.value.results) {
          add({ kind: 'skill', path: skillFilePath(result), label: result.skillName, score: result.score });
        }
      }

      return [...hits.values()].sort((a, b) => b.score - a.score);
    },
    enabled: trimmed.length > 0,
  });
}
