import type { SandboxProcess } from '@mastra/client-js';
import type { QueryStatus } from '@tanstack/react-query';
import { workspaceMetadata } from '../tools/badges/workspace-data-parts';
import type { DataMessagePart } from '../tools/tool-card';
import { BackgroundCommandCard } from './background-command-card';
import type { BackgroundCommandCardProps, BackgroundCommandState } from './background-command-card';
import { exitFor } from './thread-background-work';
import type { ThreadBackgroundWork } from './thread-background-work';
import { useThreadSandboxProcesses } from './use-thread-sandbox-processes';

type CardProps = Omit<BackgroundCommandCardProps, 'state'>;

export interface BackgroundCommandBadgeProps extends CardProps {
  pid: string;
  dataParts?: ReadonlyArray<DataMessagePart>;
  work: ThreadBackgroundWork;
  threadId: string;
}

function processState(process: SandboxProcess | undefined, status: QueryStatus): BackgroundCommandState {
  if (status === 'pending') return { phase: 'pending' };
  if (status === 'error') return { phase: 'unavailable' };
  if (process?.running) return { phase: 'running', startedAt: process.metadata?.startedAt };
  if (process?.exitCode !== undefined) return { phase: 'exited', exitCode: process.exitCode };
  return { phase: 'ended' };
}

/** Follows the process through the thread's sandbox process list until it is gone. */
function ListedBackgroundCommand({
  workspaceId,
  threadId,
  pid,
  ...card
}: CardProps & { workspaceId: string; threadId: string; pid: string }) {
  const { data, status } = useThreadSandboxProcesses({ workspaceId, threadId });
  // PIDs are reused across sandbox restarts, so a listed process must also come from this call.
  const process = data?.processes.find(
    entry => entry.pid === pid && (entry.metadata?.toolCallId ?? card.toolCallId) === card.toolCallId,
  );
  return <BackgroundCommandCard {...card} state={processState(process, status)} />;
}

/**
 * A background `execute_command` call in a chat that tracks its thread's background work. Its exit
 * notice ends it; until one arrives the sandbox's process list says whether it still runs.
 */
export function BackgroundCommandBadge({ pid, dataParts, work, threadId, ...card }: BackgroundCommandBadgeProps) {
  const exit = exitFor(work, { toolCallId: card.toolCallId, pid });
  const workspaceId = workspaceMetadata(dataParts, card.toolCallId)?.id;

  if (exit) return <BackgroundCommandCard {...card} state={{ phase: 'exited', exitCode: exit.exitCode }} />;
  if (workspaceId) {
    return <ListedBackgroundCommand {...card} workspaceId={workspaceId} threadId={threadId} pid={pid} />;
  }
  return <BackgroundCommandCard {...card} state={{ phase: 'unavailable' }} />;
}
