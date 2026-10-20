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

/** Tools that start, read or stop background processes. */
const PROCESS_CHANGING_TOOLS = new Set([
  'execute_command',
  'get_process_output',
  'kill_process',
  'mastra_workspace_execute_command',
  'mastra_workspace_get_process_output',
  'mastra_workspace_kill_process',
]);

function finishedToolCalls(transcript: readonly TimelineEntry[], tools: ReadonlySet<string>): string[] {
  const ids: string[] = [];
  for (const entry of transcript) {
    if (entry.kind !== 'message') continue;
    for (const part of entry.message.content.parts ?? []) {
      if (part.type !== 'tool-invocation') continue;
      const tool = toolFromInvocationPart(part, entry.runtimeTools?.[part.toolInvocation.toolCallId]);
      if (tool.status !== 'running' && tools.has(tool.toolName)) ids.push(tool.toolCallId);
    }
  }
  return ids;
}

/**
 * Mark the Files tab's folders and open file stale whenever a tool that can
 * change files finishes, and the Processes list and output whenever a tool
 * that starts, reads or stops a process finishes, so what's on screen
 * refetches (and anything else refetches when next shown). Tool calls already
 * in the transcript on mount don't count: the first fetch is already fresh.
 */
export function useRefreshWorkspaceFilesOnToolCalls(
  workspacePath: string | undefined,
  transcript: readonly TimelineEntry[],
) {
  const queryClient = useQueryClient();
  const seen = useRef<{ workspacePath: string | undefined; files: Set<string>; processes: Set<string> } | undefined>(
    undefined,
  );

  useEffect(() => {
    const files = finishedToolCalls(transcript, FILE_CHANGING_TOOLS);
    const processes = finishedToolCalls(transcript, PROCESS_CHANGING_TOOLS);
    const previous = seen.current;
    seen.current = { workspacePath, files: new Set(files), processes: new Set(processes) };
    if (!workspacePath || previous?.workspacePath !== workspacePath) return;
    if (files.some(id => !previous.files.has(id))) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceTreeScope(workspacePath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceFileScope(workspacePath) });
    }
    if (processes.some(id => !previous.processes.has(id))) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceProcessesScope(workspacePath) });
    }
  }, [queryClient, transcript, workspacePath]);
}
