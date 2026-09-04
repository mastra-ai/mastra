import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { WORKSPACE_TOOLS_PREFIX } from '@mastra/core/workspace';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';

export interface FirstExecCaptureSession {
  readonly identity: { getResourceId(): string };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

export interface FirstExecCaptureDependencies {
  sourceControl: {
    sessions: Pick<SourceControlStorageHandle['sessions'], 'markFirstMeaningfulExec'>;
  };
}

/**
 * Tool names that count as "meaningful exec" independent of the workspace
 * prefix. The workspace tools get remapped from `mastra_workspace_*` to
 * mastracode-friendly names (see `mastracode/sdk/src/tool-names.ts`), and
 * this listener runs on the emitted tool name after remap, so both spellings
 * need to match.
 */
const MEANINGFUL_TOOL_NAMES: ReadonlySet<string> = new Set([
  // Filesystem (post-remap)
  'view',
  'write_file',
  'string_replace_lsp',
  'find_files',
  'delete_file',
  'file_stat',
  'mkdir',
  // Search
  'search_content',
  // Code intelligence
  'ast_smart_edit',
  'lsp_inspect',
  // Sandbox
  'execute_command',
  'get_process_output',
  'kill_process',
]);

export function isMeaningfulToolName(name: string | undefined): boolean {
  if (!name) return false;
  if (name.startsWith(`${WORKSPACE_TOOLS_PREFIX}_`)) return true;
  return MEANINGFUL_TOOL_NAMES.has(name);
}

/**
 * Record when a session's agent completed its first successful meaningful
 * tool call (the TTFME anchor — "time to first meaningful exec").
 *
 * Meaningful = a workspace tool the agent invoked itself (filesystem,
 * search, code intelligence, sandbox exec, process control). We accept any
 * tool whose name starts with the workspace prefix `mastra_workspace_` or
 * matches the post-remap mastracode tool names. Non-workspace tools (memory,
 * notification inbox, subagent, etc.) and skill-loader / preflight /
 * materializer `sandbox.executeCommand()` calls that never flow through the
 * tool layer are intentionally excluded.
 *
 * Failed tool calls (`isError === true`) don't count. Approval-denied and
 * abort-while-parked tool completions (`denied === true`) also don't count:
 * the run-engine emits `tool_end` with `isError: false` for those paths
 * because the tool didn't fail, but it also never ran, so treating them as
 * "meaningful exec" would re-introduce the same contamination this fix is
 * removing on the message side. The listener stays subscribed until a
 * successful qualifying end, then unsubscribes. The storage write is guarded
 * (`first_meaningful_exec_at IS NULL`), so restarts, re-materialized
 * sessions, and sessions without a source-control row are no-ops.
 */
export function observeSessionFirstExec(
  session: FirstExecCaptureSession,
  { sourceControl }: FirstExecCaptureDependencies,
): () => void {
  let seen = false;
  // toolCallId -> toolName. Populated on `tool_start`, consumed on `tool_end`.
  // Suspended entries survive `agent_end` so the resumed run can still resolve
  // its tool name when the eventual `tool_end` arrives.
  const toolNames = new Map<string, string>();
  const suspended = new Set<string>();
  const unsubscribe = session.subscribe(event => {
    if (seen) return;
    switch (event.type) {
      case 'tool_start': {
        toolNames.set(event.toolCallId, event.toolName);
        return;
      }
      case 'tool_suspended': {
        suspended.add(event.toolCallId);
        return;
      }
      case 'tool_suspension_cancelled': {
        toolNames.delete(event.toolCallId);
        suspended.delete(event.toolCallId);
        return;
      }
      case 'agent_end': {
        // Drop any in-flight starts that will never see a matching `tool_end`
        // on this run. Genuinely suspended calls stay so their eventual
        // resume-time `tool_end` can still map back to a tool name. Without
        // this, sessions that repeatedly abort or error before a qualifying
        // completion would accumulate stale entries for the entire lifetime
        // of the subscription.
        for (const id of toolNames.keys()) {
          if (!suspended.has(id)) toolNames.delete(id);
        }
        return;
      }
      case 'tool_end': {
        const toolName = toolNames.get(event.toolCallId);
        toolNames.delete(event.toolCallId);
        suspended.delete(event.toolCallId);
        if (event.isError) return;
        if (event.denied) return;
        if (!isMeaningfulToolName(toolName)) return;
        seen = true;
        unsubscribe();
        void sourceControl.sessions
          .markFirstMeaningfulExec({ sessionId: session.identity.getResourceId() })
          .catch(error => console.warn('[Factory first-exec capture] Unable to persist first exec time.', error));
        return;
      }
    }
  });
  return unsubscribe;
}
