import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import type { ChatToolData, ToolCardProps, AgentMessage } from '@mastra/playground-ui/domains/chat';
import { resolveAgentMessages } from '@mastra/playground-ui/domains/chat';
import { useMastraClient } from '@mastra/react';
import { replaceEqualDeep, useQuery } from '@tanstack/react-query';
import { useCallback, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { isRecord } from '../messages/signal-data';
import { resolveToChildMessages } from '../tools/badges/resolve-child-messages';
import { useToolApprovalActions } from '../tools/badges/use-tool-approval-actions';
import { ToolCallEffects } from '../tools/tool-call-effects';
import { toolCardKind, toolInteraction } from '../tools/tool-card-kind';
import { ChatAgentContext } from './chat-context';
import { useAgentPlan } from '@/domains/agents/hooks/use-agent-plan';
import type { McpAppToolInfo } from '@/domains/mcps/hooks/use-mcp-app-tools';
import { convertWorkflowRunStateToStreamResult } from '@/domains/workflows/utils';
import { useWorkflow } from '@/hooks';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { useGetBackgroundTaskById, useBackgroundTaskStream } from '@/hooks/use-background-tasks';
import { useWorkflowRun, useWorkflowRuns } from '@/hooks/use-workflow-runs';

export type ChatCall = Omit<ToolCardProps, keyof import('@mastra/playground-ui/domains/chat').ChatToolContext>;
type ToolDataMap = Record<string, ChatToolData>;
interface DataProps {
  call: ChatCall;
  children: (data: ChatToolData, nested?: ChatCall[]) => ReactNode;
}

function PlanData({ path, children }: DataProps & { path: string }) {
  const { agentId = '', agentVersionId, requestContext } = useContext(ChatAgentContext) ?? {};
  const { data, isLoading, isError } = useAgentPlan({ agentId, agentVersionId, requestContext, path });
  return children({ plan: { content: data?.content, isLoading, isError } });
}

function AgentData({ call, children }: DataProps) {
  const result = call.output;
  const shouldFetch = Boolean(result?.subAgentThreadId && !result.text && !result.subAgentToolResults?.length);
  const { data, isLoading } = useAgentMessages({
    threadId: shouldFetch ? result?.subAgentThreadId : undefined,
    agentId: call.toolName.replace(/^agent-/, ''),
    memory: true,
  });
  const fetched = (
    data?.messages ? resolveToChildMessages(toAISdkV5Messages(data.messages)) : []
  ).flatMap<AgentMessage>(message => {
    if (message.type === 'text') return [{ type: 'text', content: message.content ?? '' }];
    if (!message.toolCallId || !message.toolName) return [];
    return [
      {
        type: 'tool',
        toolCallId: message.toolCallId,
        toolName: message.toolName,
        args: message.args,
        toolOutput: message.toolOutput,
      },
    ];
  });
  const messages = resolveAgentMessages(result, fetched);
  const nested = messages.flatMap(message =>
    message.type === 'tool' && message.toolCallId && message.toolName
      ? [
          {
            toolCallId: message.toolCallId,
            toolName: message.toolName,
            input: message.args,
            output: message.toolOutput,
            state: message.toolOutput === undefined ? 'call' : 'result',
          },
        ]
      : [],
  );
  return children({ agent: { messages, isLoading } }, nested);
}

function WorkflowData({ call, children }: DataProps) {
  const workflowId = call.toolName.replace(/^workflow-/, '');
  const { data: workflow, isLoading } = useWorkflow(workflowId);
  const isStreaming = call.metadata?.mode === 'stream' || call.metadata?.mode === 'network';
  const runId = call.output?.runId;
  const { data: runs, isLoading: isRunsLoading } = useWorkflowRuns(workflowId, { enabled: !isStreaming });
  const storedSnapshot = runs?.find(run => run.runId === runId)?.snapshot;
  const snapshot = typeof storedSnapshot === 'string' ? JSON.parse(storedSnapshot) : storedSnapshot;
  const { data: execution, isLoading: isRunLoading } = useWorkflowRun(workflowId, runId ?? '');
  const runSnapshot =
    execution && runId
      ? {
          runId,
          context: { input: execution.payload, ...execution.steps },
          status: execution.status,
          result: execution.result,
          error: execution.error,
          serializedStepGraph: execution.serializedStepGraph ?? [],
          value: execution.initialState ?? {},
          activePaths: [],
          activeStepsPath: execution.activeStepsPath ?? {},
          suspendedPaths: execution.suspendedPaths ?? {},
          resumeLabels: execution.resumeLabels ?? {},
          waitingPaths: execution.waitingPaths ?? {},
          timestamp: new Date(execution.updatedAt ?? execution.createdAt).getTime(),
        }
      : undefined;
  return children({
    workflow: {
      workflow: workflow ?? undefined,
      isLoading,
      isRunLoading: isRunsLoading || isRunLoading,
      snapshot: runSnapshot ?? snapshot,
      runResult: snapshot ? convertWorkflowRunStateToStreamResult(snapshot) : undefined,
    },
  });
}

function McpData({ appInfo, children }: DataProps & { appInfo: McpAppToolInfo }) {
  const client = useMastraClient();
  const { data: html, isLoading } = useQuery({
    queryKey: ['mcp-app-html', appInfo.serverId, appInfo.resourceUri],
    queryFn: async () => {
      const response = await client.readMcpServerResource(appInfo.serverId, appInfo.resourceUri);
      return response.contents?.[0]?.text ?? '';
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  return children({ mcpApp: { html: html ?? '', isLoading: isLoading || !html } });
}

function BackgroundData({
  task,
  children,
}: {
  task: { taskId: string; completedAt?: Date; suspendedAt?: Date };
  children: (data: ChatToolData) => ReactNode;
}) {
  const { data } = useGetBackgroundTaskById(task.taskId, !!task.completedAt || !!task.suspendedAt);
  const { tasks } = useBackgroundTaskStream({ taskId: task.taskId, enabled: !task.completedAt && !task.suspendedAt });
  return children({ backgroundTask: data || tasks[task.taskId] });
}

function SpecializedData({ call, mcpAppTools, children }: DataProps & { mcpAppTools: Record<string, McpAppToolInfo> }) {
  const kind = toolCardKind(call, { metadata: call.metadata, mcpAppTools });
  if (kind === 'agent') return <AgentData call={call}>{children}</AgentData>;
  if (kind === 'workflow') return <WorkflowData call={call}>{children}</WorkflowData>;
  if (kind === 'submit_plan' && !call.output?.submittedPlan) {
    const { suspended } = toolInteraction(call.metadata, call.toolName, call.toolCallId);
    const payload = suspended?.suspendPayload;
    if (isRecord(payload) && typeof payload.path === 'string' && payload.path) {
      return (
        <PlanData call={call} path={payload.path}>
          {children}
        </PlanData>
      );
    }
  }
  const appInfo = mcpAppTools[call.toolName];
  if (appInfo && call.output !== undefined && (kind === 'plain' || kind === 'mcp_app' || kind === 'background')) {
    return (
      <McpData call={call} appInfo={appInfo}>
        {children}
      </McpData>
    );
  }
  return children({});
}

function ConnectedToolData({
  call,
  mcpAppTools,
  children,
}: DataProps & { mcpAppTools: Record<string, McpAppToolInfo> }) {
  const { approval } = toolInteraction(call.metadata, call.toolName, call.toolCallId);
  const { status, isRunning: isSubmitting } = useToolApprovalActions({
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    toolApprovalMetadata: approval,
    isNetwork: call.metadata?.mode === 'network',
    isGenerateMode: call.metadata?.mode === 'generate',
    toolCalled: false,
  });
  const task =
    call.metadata?.mode === 'stream' || call.metadata?.mode === 'generate'
      ? call.metadata.backgroundTasks?.[call.toolCallId]
      : undefined;
  const renderData = (background: ChatToolData) => (
    <SpecializedData call={call} mcpAppTools={mcpAppTools}>
      {(data, nested) => children({ ...background, ...data, approvalStatus: status, isSubmitting }, nested)}
    </SpecializedData>
  );
  return (
    <>
      <ToolCallEffects {...call} />
      {task?.taskId && task.startedAt ? <BackgroundData task={task}>{renderData}</BackgroundData> : renderData({})}
    </>
  );
}

function ToolDataReport({
  id,
  value,
  report,
}: {
  id: string;
  value: ChatToolData;
  report: (id: string, value: ChatToolData) => void;
}) {
  useLayoutEffect(() => {
    report(id, value);
  }, [id, value, report]);
  return null;
}

function ToolDataLoaders({
  calls,
  mcpAppTools,
  report,
  ancestors = [],
}: {
  calls: ChatCall[];
  mcpAppTools: Record<string, McpAppToolInfo>;
  report: (id: string, value: ChatToolData) => void;
  ancestors?: string[];
}) {
  return calls
    .filter(call => !ancestors.includes(call.toolCallId))
    .map(call => (
      <ConnectedToolData key={call.toolCallId} call={call} mcpAppTools={mcpAppTools}>
        {(value, nested = []) => (
          <>
            <ToolDataReport id={call.toolCallId} value={value} report={report} />
            <ToolDataLoaders
              calls={nested}
              mcpAppTools={mcpAppTools}
              report={report}
              ancestors={[...ancestors, call.toolCallId]}
            />
          </>
        )}
      </ConnectedToolData>
    ));
}

/** Loaders are siblings: adding a streamed tool never remounts the message renderer. */
export function CollectChatToolData({
  calls,
  mcpAppTools,
  children,
}: {
  calls: ChatCall[];
  mcpAppTools: Record<string, McpAppToolInfo>;
  children: (data: ToolDataMap) => ReactNode;
}) {
  const [data, setData] = useState<ToolDataMap>({});
  const report = useCallback((id: string, value: ChatToolData) => {
    setData(previous => {
      const next = replaceEqualDeep(previous[id], value);
      return next === previous[id] ? previous : { ...previous, [id]: next };
    });
  }, []);
  return (
    <>
      <ToolDataLoaders calls={calls} mcpAppTools={mcpAppTools} report={report} />
      {children(data)}
    </>
  );
}
