import { keepPreviousData, skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type {
  EditorFileOriginal,
  EditorLspQueryKind,
  EditorLspResponse,
  EditorSearchResponse,
  EditorTreeListing,
  WorkspaceFile,
} from '../api/types';

function editorTreeUrl(workspacePath: string | undefined, path: string | undefined) {
  if (!workspacePath) return undefined;
  const params = new URLSearchParams({ workspacePath });
  if (path) params.set('path', path);
  return `/web/workspace/tree?${params}`;
}

function editorFileUrl(workspacePath: string | undefined, filePath: string | undefined) {
  if (!workspacePath || !filePath) return undefined;
  // Absolute paths are LSP results outside the checkout (dependencies, the
  // TypeScript stdlib…) — served read-only through the library route.
  if (filePath.startsWith('/')) {
    return `/web/workspace/file/library?${new URLSearchParams({ workspacePath, path: filePath })}`;
  }
  // `/web/workspace/file` (fs.ts) only serves `.artifacts`; the editor reads
  // the full checkout through the session-sandbox route.
  return `/web/workspace/file/read?${new URLSearchParams({ workspacePath, path: filePath })}`;
}

function editorSearchUrl(workspacePath: string | undefined, query: string | undefined) {
  if (!workspacePath || !query || query.trim().length < 2) return undefined;
  return `/web/workspace/search?${new URLSearchParams({ workspacePath, q: query })}`;
}

/**
 * Recursive workspace tree for the editor's file browser. Unlike the
 * `.artifacts/*` allowlist used by preview surfaces, this walks the entire
 * session workdir (skipping heavy directories on the server side).
 */
export function useEditorTree(
  workspacePath: string | undefined,
  path?: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url = editorTreeUrl(workspacePath, path);
  return useQuery<EditorTreeListing>({
    queryKey: queryKeys.editorTree(workspacePath, path),
    enabled,
    // The tree is expensive to recompute and rarely changes shape mid-session;
    // keep it warm so tab toggles and remounts render instantly.
    staleTime: 30_000,
    queryFn: url ? () => client.get<EditorTreeListing>(url) : skipToken,
  });
}

/**
 * Read a workspace file for editing. The response reuses the read-only
 * `WorkspaceFile` shape so text content flows straight into the editor buffer.
 */
export function useEditorFile(
  workspacePath: string | undefined,
  filePath: string | undefined,
  { enabled = true, pollMs }: { enabled?: boolean; pollMs?: number } = {},
) {
  const { client } = useApiConfig();
  const url = editorFileUrl(workspacePath, filePath);
  return useQuery<WorkspaceFile>({
    queryKey: queryKeys.editorFile(workspacePath, filePath),
    enabled,
    // Dirty buffers poll the disk copy so agent edits to the same file are
    // detected as drift instead of silently diverging.
    refetchInterval: pollMs,
    queryFn: url ? () => client.get<WorkspaceFile>(url) : skipToken,
  });
}

export interface SaveEditorFileVariables {
  workspacePath: string;
  path: string;
  content: string;
}

/**
 * Save the editor buffer back to the sandbox workdir. On success we invalidate
 * both the editor file cache (so subsequent reads see the new bytes) and the
 * workspace changes/diff caches (so the git gutter reflects the staged edit).
 */
export function useSaveEditorFile() {
  const { client } = useApiConfig();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: SaveEditorFileVariables) =>
      client.put<{ workspacePath: string; path: string; size: number; updatedAt: string }>(
        `/web/workspace/file/write?${new URLSearchParams({ workspacePath: vars.workspacePath })}`,
        { path: vars.path, content: vars.content },
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.editorFile(vars.workspacePath, vars.path) });
      void qc.invalidateQueries({ queryKey: queryKeys.workspaceChanges(vars.workspacePath) });
      void qc.invalidateQueries({ queryKey: ['workspace-changes', vars.workspacePath, 'diff'] });
    },
  });
}

/**
 * The original blob for a file — the "original" side of the inline diff view.
 * `against: 'head'` (default) reads the git HEAD blob; `against: 'base'` reads
 * the blob at the merge-base with the session's base branch, so review
 * sessions diff exactly what the PR changes. Files missing at the compared
 * revision come back `exists: false` and diff against empty.
 */
export function useEditorFileOriginal(
  workspacePath: string | undefined,
  filePath: string | undefined,
  { enabled = true, against = 'head' }: { enabled?: boolean; against?: 'head' | 'base' } = {},
) {
  const { client } = useApiConfig();
  const url =
    workspacePath && filePath
      ? `/web/workspace/file/original?${new URLSearchParams({ workspacePath, path: filePath, against })}`
      : undefined;
  return useQuery<EditorFileOriginal>({
    queryKey: queryKeys.editorFileOriginal(workspacePath, filePath, against),
    enabled,
    queryFn: url ? () => client.get<EditorFileOriginal>(url) : skipToken,
  });
}

export interface EditorLspQueryInput {
  path: string;
  /** 1-indexed. */
  line: number;
  /** 1-indexed. */
  character: number;
  kind: EditorLspQueryKind;
  /** Unsaved buffer content — pushed to the language server before querying. */
  content?: string;
  /** Required for `kind: 'rename'` — the new symbol name. */
  newName?: string;
}

/**
 * Imperative LSP query function for the editor's hover tooltips and go-to
 * commands. Not a React Query hook — hover queries are transient and
 * position-keyed, so caching them buys nothing.
 */
export function useEditorLspQuery(workspacePath: string | undefined) {
  const { client } = useApiConfig();
  return useCallback(
    async (input: EditorLspQueryInput): Promise<EditorLspResponse | null> => {
      if (!workspacePath) return null;
      try {
        return await client.post<EditorLspResponse>(
          `/web/workspace/lsp?${new URLSearchParams({ workspacePath })}`,
          input,
        );
      } catch {
        return null;
      }
    },
    [client, workspacePath],
  );
}

/**
 * Content search across the workspace. The server truncates at
 * `MAX_SEARCH_MATCHES` and returns `truncated: true` so the UI can hint the
 * user to narrow the query.
 */
export function useEditorSearch(
  workspacePath: string | undefined,
  query: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url = editorSearchUrl(workspacePath, query);
  return useQuery<EditorSearchResponse>({
    queryKey: queryKeys.editorSearch(workspacePath, query),
    enabled,
    // Live-search UX: show the previous results while the next query is in
    // flight instead of flashing an empty panel on every keystroke.
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    queryFn: url ? () => client.get<EditorSearchResponse>(url) : skipToken,
  });
}
