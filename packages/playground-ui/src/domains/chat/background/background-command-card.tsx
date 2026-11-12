import { parseToolArgs } from '../tools/badges/workspace-data-parts';
import { BackgroundTag } from './background-tag';
import { ExitCode } from './exit-code';
import { RunningFor } from './running-for';
import { ToolApprovalBadge } from '@/domains/chat/tools/badges/tool-approval-badge';
import type { ToolApprovalRequest } from '@/domains/chat/tools/badges/tool-approval-badge';
import type { ActivityStatus } from '@/ds/components/ai/activity';
import { presentTool, ToolCallBody, toolCallHasBody } from '@/ds/components/ai/tool-call';
import type { ToolCallView } from '@/ds/components/ai/tool-call';
import { Txt } from '@/ds/components/Txt';

/** Where a background process stands, as far as the chat can tell. */
export type BackgroundCommandState =
  | { phase: 'running'; startedAt?: number }
  | { phase: 'exited'; exitCode: number }
  /** Gone from the sandbox with no exit on record: its output was read, or the sandbox restarted. */
  | { phase: 'ended' }
  /** The sandbox's process list is on its way. */
  | { phase: 'pending' }
  /** No sandbox to ask, or it couldn't be read. */
  | { phase: 'unavailable' };

export interface BackgroundCommandCardProps extends Omit<ToolApprovalRequest, 'toolCalled'> {
  args: Record<string, unknown> | string;
  result: string;
  state: BackgroundCommandState;
}

const cardStatus = (state: BackgroundCommandState): ActivityStatus => {
  if (state.phase === 'running') return 'running';
  if (state.phase === 'exited' && state.exitCode !== 0) return 'error';
  return 'idle';
};

function StateTag({ state }: { state: BackgroundCommandState }) {
  if (state.phase === 'running') return <BackgroundTag />;
  if (state.phase === 'pending') return <BackgroundTag live={false} />;
  return null;
}

const MutedMeta = ({ children }: { children: string }) => (
  <Txt as="span" variant="meta" tone="muted" className="px-1">
    {children}
  </Txt>
);

function BackgroundCommandOutcome({ state }: { state: BackgroundCommandState }) {
  if (state.phase === 'running') {
    return state.startedAt === undefined ? null : <RunningFor startedAt={state.startedAt} />;
  }
  if (state.phase === 'exited') return <ExitCode exitCode={state.exitCode} />;
  if (state.phase === 'ended') return <MutedMeta>ended</MutedMeta>;
  if (state.phase === 'unavailable') return <MutedMeta>status unavailable</MutedMeta>;
  return null;
}

const hasTag = (state: BackgroundCommandState) => state.phase === 'running' || state.phase === 'pending';

/** An `execute_command` call that started a background process: drawn by how the process stands, not by the call. */
export function BackgroundCommandCard({
  toolName,
  toolCallId,
  args,
  result,
  toolApprovalMetadata,
  isNetwork,
  isGenerateMode,
  state,
}: BackgroundCommandCardProps) {
  const parsedArgs = parseToolArgs(args);
  const { icon: ToolIcon, label, detail, description, command } = presentTool(toolName, parsedArgs);
  const status = cardStatus(state);
  const view: ToolCallView = { toolName, args: parsedArgs, status, command, result };

  return (
    <ToolApprovalBadge
      approval={{ toolCalled: true, toolCallId, toolApprovalMetadata, toolName, isNetwork, isGenerateMode }}
      data-testid="background-command-badge"
      icon={<ToolIcon aria-hidden />}
      title={label}
      detail={detail}
      description={description}
      status={status}
      badges={hasTag(state) ? <StateTag state={state} /> : undefined}
      extraInfo={<BackgroundCommandOutcome state={state} />}
    >
      {toolCallHasBody(view) && <ToolCallBody {...view} />}
    </ToolApprovalBadge>
  );
}
