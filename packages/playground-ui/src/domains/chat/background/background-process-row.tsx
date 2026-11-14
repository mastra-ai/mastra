import type { SandboxProcess } from '@mastra/client-js';
import { useKillSandboxProcess } from '@mastra/react/hooks/workspace';
import { WORKSPACE_TOOLS } from '../tools/workspace-tool-constants';
import { BackgroundProcessOutput } from './background-process-output';
import { BackgroundWorkRow } from './background-work-row';
import { StopBackgroundWorkButton } from './stop-background-work-button';
import { presentTool } from '@/ds/components/ai/tool-call';
import { toast } from '@/lib/toast';

export interface BackgroundProcessRowProps {
  workspaceId: string;
  threadId: string;
  process: SandboxProcess;
}

export function BackgroundProcessRow({ workspaceId, threadId, process }: BackgroundProcessRowProps) {
  const {
    icon: Icon,
    label,
    detail,
  } = presentTool(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND, { command: process.command });
  const kill = useKillSandboxProcess();
  const name = detail ?? `PID ${process.pid}`;

  return (
    <BackgroundWorkRow
      icon={<Icon aria-hidden />}
      label={label}
      detail={name}
      startedAt={process.metadata?.startedAt}
      stop={
        <StopBackgroundWorkButton
          action="Kill process"
          title="Kill this process?"
          description={`${name} stops now. The agent isn't told it exited.`}
          pending={kill.isPending}
          onConfirm={() =>
            kill.mutate(
              { workspaceId, threadId, pid: process.pid },
              { onError: error => toast.error(`Couldn't kill the process: ${error.message}`) },
            )
          }
        />
      }
    >
      <BackgroundProcessOutput workspaceId={workspaceId} threadId={threadId} pid={process.pid} />
    </BackgroundWorkRow>
  );
}
