import type { DataMessagePart } from '../tool-card';
import { isRecord } from '@/domains/chat/messages/signal-data';
import type { ToolCallExit } from '@/ds/components/ai/tool-call';

interface WorkspaceResource {
  id?: string;
  name?: string;
  provider?: string;
  status?: string;
}

/** Shape of `workspace.getInfo()`, written by workspace tools as a `workspace-metadata` data part. */
export interface WorkspaceMetadata {
  toolName?: string;
  id?: string;
  name?: string;
  status?: string;
  filesystem?: WorkspaceResource;
  sandbox?: WorkspaceResource;
}

export function parseToolArgs(args: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof args !== 'string') return args;
  try {
    const parsed: unknown = JSON.parse(args);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function toolDataParts(
  dataParts: ReadonlyArray<DataMessagePart> | undefined,
  name: string,
  toolCallId: string,
): DataMessagePart[] {
  return (dataParts ?? []).filter(
    part => part.type === 'data' && part.name === name && part.data?.toolCallId === toolCallId,
  );
}

export function workspaceMetadata(
  dataParts: ReadonlyArray<DataMessagePart> | undefined,
  toolCallId: string,
): WorkspaceMetadata | undefined {
  return toolDataParts(dataParts, 'workspace-metadata', toolCallId)[0]?.data;
}

export interface SandboxExit extends ToolCallExit {
  executionTimeMs?: number;
}

export function sandboxExit(
  dataParts: ReadonlyArray<DataMessagePart> | undefined,
  toolCallId: string,
): SandboxExit | undefined {
  const exit = toolDataParts(dataParts, 'sandbox-exit', toolCallId)[0]?.data;
  if (typeof exit?.exitCode !== 'number') return undefined;
  // Any tool can write this part, so an error that is not text is left out rather than drawn.
  return typeof exit.error === 'string' || exit.error === undefined ? exit : { ...exit, error: undefined };
}
