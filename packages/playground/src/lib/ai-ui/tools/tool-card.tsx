import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { AskUserTool } from './ask-user-tool';
import { AgentBadgeWrapper } from './badges/agent-badge-wrapper';
import { CodeModeBadge, getCodeModeCall } from './badges/code-mode-badge';
import { FileTreeBadge } from './badges/file-tree-badge';
import { ObservationMarkerBadge } from './badges/observation-marker-badge';
import { SandboxExecutionBadge } from './badges/sandbox-execution-badge';
import { ToolBadge } from './badges/tool-badge';
import { useWorkflowStream, WorkflowBadge } from './badges/workflow-badge';
import { useActivatedSkills } from '@/domains/agents/context/activated-skills-context';
import {
  isBrowserTool,
  isBrowserToolError,
  useBrowserToolCallsSafe,
} from '@/domains/agents/context/browser-tool-calls-context';
import type { BrowserSessionProbe } from '@/domains/agents/hooks/use-browser-session-probe';
import { McpAppToolResult } from '@/domains/mcps/components/mcp-app-tool-result';
import { useMcpAppTools } from '@/domains/mcps/hooks';
import { WorkflowRunProvider } from '@/domains/workflows';
import { WORKSPACE_TOOLS } from '@/domains/workspace/constants';
import { useChatSend } from '@/lib/ai-ui/chat/chat-context';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

/**
 * Plain-prop tool dispatcher for the main agent chat, replacing assistant-ui's
 * `ToolFallback` (which read `ToolCallMessagePartProps`/`useAui`). `MessageRow`
 * normalizes both v4 `ToolInvocation` and v5 `DynamicTool` parts into this shape.
 *
 * It is a real component (not a render function) on purpose: it must host hooks —
 * notably `useWorkflowStream(output)` inside `WorkflowRunProvider` so a streaming
 * workflow run keeps animating a live `WorkflowGraph`, exactly as before.
 */
/**
 * A `data`-typed message part emitted by the agent via `writer.custom`, scoped to
 * a tool call by `data.toolCallId`. `MessageRow` collects these from the parent
 * `MastraDBMessage` and forwards them so badges (file-tree, sandbox) can read live
 * streaming metadata without reaching into assistant-ui state.
 */
export interface DataMessagePart {
  type: string;
  name?: string;
  data?: any;
}

export interface ToolCardProps {
  toolName: string;
  input: any;
  output: any;
  toolCallId: string;
  /** Part state: v5 `output-available`/`output-error`/`input-available`, or v4 `result`/`call`. */
  state?: string;
  metadata?: MessageMetadata;
  /** `data`-typed parts from the parent message, for badges that read live streaming metadata. */
  dataParts?: ReadonlyArray<DataMessagePart>;
}

const TASK_TOOL_NAMES = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);

export const ToolCard = (props: ToolCardProps) => {
  return (
    <WorkflowRunProvider workflowId={''} withoutTimeTravel>
      <ToolCardInner {...props} />
    </WorkflowRunProvider>
  );
};

export const ToolCardInner = ({ toolName, input, output, toolCallId, state, metadata, dataParts }: ToolCardProps) => {
  // All hooks must run unconditionally before any conditional returns.
  const browserCtx = useBrowserToolCallsSafe();
  const isBrowser = isBrowserTool(toolName);
  const { activateSkill } = useActivatedSkills();
  const { data: mcpAppToolsMap } = useMcpAppTools();
  const send = useChatSend();
  const queryClient = useQueryClient();

  const args = input;
  const result = output;
  const isComplete = state === 'output-available' || state === 'result';

  const handleMcpAppSendMessage = useCallback(
    (content: string) => {
      send({ message: content });
    },
    [send],
  );

  useEffect(() => {
    if (!isBrowser || !browserCtx) return;

    let status: 'pending' | 'complete' | 'error' = 'pending';
    if (result !== undefined) {
      status = isBrowserToolError(result) ? 'error' : 'complete';
    }

    browserCtx.registerToolCall({
      toolCallId,
      toolName,
      args: typeof args === 'object' ? args : {},
      result,
      status,
      timestamp: Date.now(),
    });

    // Seeing any browser tool call means the server has an active session for
    // this thread, so the probe can flip to `hasSession: true` immediately.
    // `setQueriesData` always notifies observers, so read synchronously via
    // `getQueriesData` first and only write entries that need to change.
    // Preserve each probe's existing `screencastAvailable`.
    const cachedProbes = queryClient.getQueriesData<BrowserSessionProbe>({
      queryKey: ['browser-session-probe'],
    });
    const needsUpdate = cachedProbes.some(([, data]) => data?.screencastAvailable && !data.hasSession);
    if (needsUpdate) {
      queryClient.setQueriesData<BrowserSessionProbe>({ queryKey: ['browser-session-probe'] }, prev => {
        if (!prev) return prev;
        if (!prev.screencastAvailable) return prev;
        if (prev.hasSession) return prev;
        return { ...prev, hasSession: true };
      });
    }
  }, [isBrowser, toolCallId, toolName, args, result, browserCtx, queryClient]);

  // Detect skill activation tool calls.
  useEffect(() => {
    if (toolName !== 'skill') return;
    if (!args?.name) return;
    if (!isComplete) return;
    activateSkill(args.name);
  }, [toolName, args?.name, isComplete, activateSkill]);

  useWorkflowStream(result);

  // OM observation markers render as ObservationMarkerBadge.
  if (toolName === 'mastra-memory-om-observation') {
    const omData = result?.omData ?? args;
    return (
      <ObservationMarkerBadge
        toolName={toolName}
        args={omData}
        metadata={metadata ? { ...metadata, omData } : undefined}
      />
    );
  }

  const isAgent = (metadata?.mode === 'network' && metadata.from === 'AGENT') || toolName.startsWith('agent-');
  const isWorkflow = (metadata?.mode === 'network' && metadata.from === 'WORKFLOW') || toolName.startsWith('workflow-');

  const isNetwork = metadata?.mode === 'network';

  const agentToolName = toolName.startsWith('agent-') ? toolName.substring('agent-'.length) : toolName;
  const workflowToolName = toolName.startsWith('workflow-') ? toolName.substring('workflow-'.length) : toolName;

  const requireApprovalMetadata =
    (metadata?.mode === 'stream' || metadata?.mode === 'network' || metadata?.mode === 'generate') &&
    metadata?.requireApprovalMetadata;
  const suspendedTools =
    (metadata?.mode === 'stream' || metadata?.mode === 'network' || metadata?.mode === 'generate') &&
    metadata?.suspendedTools;

  const toolApprovalMetadata = requireApprovalMetadata
    ? (requireApprovalMetadata?.[toolName] ?? requireApprovalMetadata?.[toolCallId])
    : undefined;

  const suspendedToolMetadata = suspendedTools
    ? (suspendedTools?.[toolName] ?? suspendedTools?.[toolCallId])
    : undefined;

  const toolCalled = metadata?.mode === 'network' && metadata?.hasMoreMessages ? true : undefined;

  const isBackgroundTaskResult =
    result && typeof result === 'string' && result.toLowerCase().includes('background task');

  if (toolName === 'updateWorkingMemory') {
    // Hide the updateWorkingMemory tool call in the UI.
    return null;
  }

  // Task tool calls are rendered in the docked TaskPanel (bottom of chat) instead
  // of inline to avoid repetition. Hide them entirely here.
  if (TASK_TOOL_NAMES.has(toolName)) {
    return null;
  }

  // ask_user tool renders a dedicated interactive component for answering questions.
  if (toolName === 'ask_user') {
    return <AskUserTool toolName={toolName} toolCallId={toolCallId} output={output} metadata={metadata} />;
  }

  if (isBackgroundTaskResult) {
    return (
      <ToolBadge
        toolName={isAgent ? agentToolName : isWorkflow ? workflowToolName : toolName}
        args={args}
        result={result}
        toolOutput={[]}
        metadata={metadata}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        suspendPayload={suspendedToolMetadata?.suspendPayload}
        isNetwork={isNetwork}
        toolCalled={toolCalled}
        withoutArgs={isAgent || isWorkflow}
      />
    );
  }

  if (isAgent) {
    return (
      <AgentBadgeWrapper
        agentId={agentToolName}
        result={result}
        metadata={metadata}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        toolName={toolName}
        isNetwork={isNetwork}
        suspendPayload={suspendedToolMetadata?.suspendPayload}
        toolCalled={toolCalled}
        isComplete={isComplete}
      />
    );
  }

  if (isWorkflow) {
    const isStreaming = metadata?.mode === 'stream' || metadata?.mode === 'network';

    return (
      <WorkflowBadge
        workflowId={workflowToolName}
        isStreaming={isStreaming}
        result={result}
        metadata={metadata}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        suspendPayload={suspendedToolMetadata?.suspendPayload}
        toolName={toolName}
        isNetwork={isNetwork}
        toolCalled={toolCalled}
      />
    );
  }

  const isListFiles = toolName === WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES;

  if (isListFiles) {
    return (
      <FileTreeBadge
        toolName={toolName}
        args={args}
        result={result}
        metadata={metadata}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        isNetwork={isNetwork ?? false}
        toolCalled={toolCalled}
        dataParts={dataParts}
      />
    );
  }

  const isSandboxExecution =
    toolName === WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND ||
    toolName === WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT ||
    toolName === WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS;

  if (isSandboxExecution) {
    return (
      <SandboxExecutionBadge
        toolName={toolName}
        args={args}
        result={result}
        metadata={metadata}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        isNetwork={isNetwork}
        toolCalled={toolCalled}
        dataParts={dataParts}
      />
    );
  }

  // Code Mode (`execute_typescript`) calls carry a `code` string arg and a
  // `CodeModeResult` shape. Detect by shape since the tool id is configurable.
  const codeModeCall = getCodeModeCall(args, result);

  if (codeModeCall) {
    return (
      <CodeModeBadge
        toolName={toolName}
        code={codeModeCall.code}
        result={codeModeCall.result}
        metadata={metadata}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        isNetwork={isNetwork}
        toolCalled={toolCalled}
      />
    );
  }

  const mcpAppInfo = mcpAppToolsMap?.[toolName];

  return (
    <>
      <ToolBadge
        toolName={toolName}
        args={args}
        result={result}
        toolOutput={result?.toolOutput || []}
        metadata={metadata}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        suspendPayload={suspendedToolMetadata?.suspendPayload}
        isNetwork={isNetwork}
        toolCalled={toolCalled}
      />
      {mcpAppInfo && result !== undefined && (
        <McpAppToolResult
          appInfo={mcpAppInfo}
          toolArgs={args}
          toolResult={result}
          onSendMessage={handleMcpAppSendMessage}
        />
      )}
    </>
  );
};
