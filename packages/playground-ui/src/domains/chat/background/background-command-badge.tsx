import type { SandboxProcess } from '@mastra/client-js';
import { useContext } from 'react';
import { workspaceMetadata } from '../tools/badges/workspace-data-parts';
import type { DataMessagePart } from '../tools/tool-card';
import { BackgroundCommandCard } from './background-command-card';
import type { BackgroundCommandCardProps, BackgroundCommandState } from './background-command-card';
import { exitFor, threadBackgroundWork } from './thread-background-work';
import { useThreadSandboxProcesses } from './use-thread-sandbox-processes';
import { ChatAgentContext, useChatMessages } from '@/domains/chat/context/chat-context';

type CardProps = Omit<BackgroundCommandCardProps, 'state'>;

export interface BackgroundCommandBadgeProps extends CardProps {
  pid: string;
  dataParts?: ReadonlyArray<DataMessagePart>;
}

function processState(process: SandboxProcess | undefined, listed: boolean): BackgroundCommandState {
  if (process?.running) return { phase: 'running', startedAt: process.metadata?.startedAt };
  if (process?.exitCode !== undefined) return { phase: 'exited', exitCode: process.exitCode };
  return listed ? { phase: 'ended' } : { phase: 'unknown' };
}

/** Follows the process through the thread's sandbox process list until it is gone. */
function ListedBackgroundCommand({
  workspaceId,
  threadId,
  pid,
  ...card
}: CardProps & { workspaceId: string; threadId: string; pid: string }) {
  const { data, isSuccess } = useThreadSandboxProcesses({ workspaceId, threadId });
  // PIDs are reused across sandbox restarts, so a listed process must also come from this call.
  const process = data?.processes.find(
    entry => entry.pid === pid && (entry.metadata?.toolCallId ?? card.toolCallId) === card.toolCallId,
  );
  return <BackgroundCommandCard {...card} state={processState(process, isSuccess)} />;
}

/**
 * A background `execute_command` call. Its exit notice ends it; until one arrives the sandbox's
 * process list says whether it still runs.
 */
export function BackgroundCommandBadge({ pid, dataParts, ...card }: BackgroundCommandBadgeProps) {
  const messages = useChatMessages();
  const threadId = useContext(ChatAgentContext)?.threadId;
  const exit = exitFor(threadBackgroundWork(messages).exits, { toolCallId: card.toolCallId, pid });
  const workspaceId = workspaceMetadata(dataParts, card.toolCallId)?.id;

  if (exit) return <BackgroundCommandCard {...card} state={{ phase: 'exited', exitCode: exit.exitCode }} />;
  if (workspaceId && threadId) {
    return <ListedBackgroundCommand {...card} workspaceId={workspaceId} threadId={threadId} pid={pid} />;
  }
  return <BackgroundCommandCard {...card} state={{ phase: 'unknown' }} />;
}
