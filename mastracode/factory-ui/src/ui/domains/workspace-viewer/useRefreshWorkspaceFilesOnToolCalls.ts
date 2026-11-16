import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { queryKeys } from '../../../api/keys';
import { toolFromInvocationPart } from '../chat/components/transcript-parts';
import type { TimelineEntry } from '../chat/services/transcript';

/**
 * Tools that can change files in the sandbox, by the name the agent sees
 * (Mastra Code names, then the core workspace names they remap). A shell
 * command can touch anything, so it counts too.
 */
const FILE_CHANGING_TOOLS = new Set([
  'write_file',
  'string_replace_lsp',
  'ast_smart_edit',
  'delete_file',
  'mkdir',
  'execute_command',
  'mastra_workspace_write_file',
  'mastra_workspace_edit_file',
  'mastra_workspace_ast_edit',
  'mastra_workspace_delete',
  'mastra_workspace_mkdir',
  'mastra_workspace_execute_command',
]);

function finishedFileChanges(transcript: readonly TimelineEntry[]): string[] {
  const ids: string[] = [];
  for (const entry of transcript) {
    if (entry.kind !== 'message') continue;
    for (const part of entry.message.content.parts ?? []) {
      if (part.type !== 'tool-invocation') continue;
      const tool = toolFromInvocationPart(part, entry.runtimeTools?.[part.toolInvocation.toolCallId]);
      if (tool.status !== 'running' && FILE_CHANGING_TOOLS.has(tool.toolName)) ids.push(tool.toolCallId);
    }
  }
  return ids;
}

/**
 * Mark the Files tab's folders and open file stale whenever a tool that can
 * change files finishes, so what's on screen refetches (and anything else
 * refetches when next shown). Tool calls already in the transcript on mount
 * don't count: the first fetch is already fresh.
 */
export function useRefreshWorkspaceFilesOnToolCalls(
  workspacePath: string | undefined,
  transcript: readonly TimelineEntry[],
) {
  const queryClient = useQueryClient();
  const seen = useRef<{ workspacePath: string | undefined; ids: Set<string> } | undefined>(undefined);

  useEffect(() => {
    const ids = finishedFileChanges(transcript);
    const previous = seen.current;
    seen.current = { workspacePath, ids: new Set(ids) };
    if (!workspacePath || previous?.workspacePath !== workspacePath) return;
    if (!ids.some(id => !previous.ids.has(id))) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceTreeScope(workspacePath) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceFileScope(workspacePath) });
  }, [queryClient, transcript, workspacePath]);
}
