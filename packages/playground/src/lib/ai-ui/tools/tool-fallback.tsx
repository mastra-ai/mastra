import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { useAui } from '@assistant-ui/react';

import type { MastraUIMessage } from '@mastra/react';
import { useCallback, useEffect } from 'react';
import { AgentBadgeWrapper } from './badges/agent-badge-wrapper';
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
import { McpAppToolResult } from '@/domains/mcps/components/mcp-app-tool-result';
import { useMcpAppTools } from '@/domains/mcps/hooks';
import { WorkflowRunProvider } from '@/domains/workflows';
import { WORKSPACE_TOOLS } from '@/domains/workspace/constants';

export interface ToolFallbackProps extends ToolCallMessagePartProps<any, any> {
  metadata?: MastraUIMessage['metadata'];
}

export const ToolFallback = ({ toolName, result, args, ...props }: ToolFallbackProps) => {
  return (
    <WorkflowRunProvider workflowId={''} withoutTimeTravel>
      <ToolFallbackInner toolName={toolName} result={result} args={args} {...props} />
    </WorkflowRunProvider>
  );
};

const ToolFallbackInner = ({ toolName, result, args, metadata, toolCallId, ...props }: ToolFallbackProps) => {
  // All hooks must be called unconditionally before any conditional returns
  const browserCtx = useBrowserToolCallsSafe();
  const isBrowser = isBrowserTool(toolName);
  const { activateSkill } = useActivatedSkills();
  const { data: mcpAppToolsMap } = useMcpAppTools();
  const aui = useAui();

  const handleMcpAppSendMessage = useCallback(
    (content: string) => {
      aui.thread().append({
        role: 'user',
        content: [{ type: 'text', text: content }],
      });
    },
    [aui],
  );

  useEffect(() => {
    if (!isBrowser || !browserCtx) return;

    // Determine status: pending if no result, error if result indicates failure, else complete
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
  }, [isBrowser, toolCallId, toolName, args, result, browserCtx]);

  // Detect skill activation tool calls
  useEffect(() => {
    if (toolName !== 'skill') return;
    if (!args?.name) return;
    if (props.status?.type !== 'complete') return;
    activateSkill(args.name);
  }, [toolName, args?.name, props.status?.type, activateSkill]);

  useWorkflowStream(result);

  // Handle OM observation markers - render as ObservationMarkerBadge
  if (toolName === 'mastra-memory-om-observation') {
    return <ObservationMarkerBadge toolName={toolName} args={args} metadata={metadata} />;
  }

  // We need to handle the stream data even if the workflow is not resolved yet
  // The response from the fetch request resolving the workflow might theoretically
  // be resolved after we receive the first stream event

  const isAgent = (metadata?.mode === 'network' && metadata.from === 'AGENT') || toolName.startsWith('agent-');
  const isWorkflow = (metadata?.mode === 'network' && metadata.from === 'WORKFLOW') || toolName.startsWith('workflow-');

  const isNetwork = metadata?.mode === 'network';
  const isComplete = props.status?.type === 'complete';

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

  const suspendedToolMetadata = suspendedTools ? suspendedTools?.[toolName] : undefined;

  const toolCalled = metadata?.mode === 'network' && metadata?.hasMoreMessages ? true : undefined;

  const isBackgroundTaskResult =
    result && typeof result === 'string' && (result as string)?.toLowerCase()?.includes('background task');

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

  // Use custom tree UI for list_files tool
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
      />
    );
  }

  // Use custom terminal UI for sandbox execution tools
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
