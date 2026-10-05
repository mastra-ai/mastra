import type { UseQueryResult } from '@tanstack/react-query';
import type { SkillSearchResult } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

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
/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export function useWorkspaceSearch<TData = WorkspaceSearchHit[]>({
  workspaceId,
  query,
  files: searchFiles = true,
  skills: searchSkills = true,
  queryOptions,
}: {
  workspaceId: string;
  query: string;
  files?: boolean;
  skills?: boolean;
  queryOptions?: MastraQueryOptions<WorkspaceSearchHit[], TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  const trimmed = query.trim();

  return useQuery<WorkspaceSearchHit[], Error, TData>({
    queryKey: ['workspace', workspaceId, 'search', trimmed, searchFiles, searchSkills],
    queryFn: async () => {
      const workspace = client.getWorkspace(workspaceId);
      const [files, skills] = await Promise.allSettled([
        searchFiles ? workspace.search({ query: trimmed }) : Promise.reject(new Error('File search disabled')),
        searchSkills ? workspace.searchSkills({ query: trimmed }) : Promise.reject(new Error('Skill search disabled')),
      ]);

      if (files.status === 'rejected' && skills.status === 'rejected') {
        throw (searchFiles ? files : skills).reason;
      }

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
          add({
            kind: 'skill',
            path: skillFilePath(result),
            label: result.skillName,
            score: result.score,
          });
        }
      }

      return [...hits.values()].sort((a, b) => b.score - a.score);
    },
    ...queryOptions,
  });
}
