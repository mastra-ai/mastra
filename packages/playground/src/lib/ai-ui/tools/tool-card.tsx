import type { MessageMetadata } from '@mastra/playground-ui/domains/chat';
import { ChatAgentContext, useChatRunning, useChatSend } from '@mastra/playground-ui/domains/chat/context/chat-context';
import { AskUserTool } from '@mastra/playground-ui/domains/chat/tools/ask-user-tool';
import { CodeModeBadge } from '@mastra/playground-ui/domains/chat/tools/badges/code-mode-badge';
import { ObservationMarkerBadge } from '@mastra/playground-ui/domains/chat/tools/badges/observation-marker-badge';
import {
  badgeStatus,
  codeModeCall,
  isAgentCall,
  isSettledState,
  isWorkflowCall,
  toolCardKind,
  toolInteraction,
} from '@mastra/playground-ui/domains/chat/tools/tool-card-kind';
import { useCallback, useContext } from 'react';
import { AgentBadgeWrapper } from './badges/agent-badge-wrapper';
import { FileTreeBadge } from './badges/file-tree-badge';
import { SandboxExecutionBadge } from './badges/sandbox-execution-badge';
import { ToolBadge } from './badges/tool-badge';
import { useWorkflowStream, WorkflowBadge } from './badges/workflow-badge';
import { SubmitPlanTool } from './submit-plan-tool';
import { McpAppToolResult } from '@/domains/mcps/components/mcp-app-tool-result';
import { useMcpAppTools } from '@/domains/mcps/hooks';
import { WorkflowRunProvider } from '@/domains/workflows';

/** A `data`-typed part the agent wrote via `writer.custom`, scoped to a call by `data.toolCallId`. */
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
  /** Error message when `state` is `output-error`. */
  errorText?: string;
  metadata?: MessageMetadata;
  /** `data`-typed parts from the parent message, for badges that read live streaming metadata. */
  dataParts?: ReadonlyArray<DataMessagePart>;
  /** Historical rendering mode: preserve presentation while suppressing executable actions and side effects. */
  readOnly?: boolean;
}

const stripPrefix = (toolName: string, prefix: string): string =>
  toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName;

/** Its own workflow run scope, so a streaming workflow result can drive a live graph inside the card. */
export const ToolCard = (props: ToolCardProps) => {
  return (
    <WorkflowRunProvider workflowId={''} withoutTimeTravel>
      <ToolCardInner {...props} />
    </WorkflowRunProvider>
  );
};

export const ToolCardInner = ({
  toolName,
  input,
  output,
  toolCallId,
  state,
  errorText,
  metadata,
  dataParts,
  readOnly = false,
}: ToolCardProps) => {
  const { data: mcpAppTools } = useMcpAppTools();
  const send = useChatSend();
  const chatAgent = useContext(ChatAgentContext);
  const { isRunning } = useChatRunning();
  const handleMcpAppSendMessage = useCallback(
    (content: string) => {
      send({ message: content });
    },
    [send],
  );
  useWorkflowStream(output);

  const kind = toolCardKind({ toolName, toolCallId, input, output, state }, { metadata, mcpAppTools });
  const { approval: toolApprovalMetadata, suspended: suspendedToolMetadata } = toolInteraction(
    metadata,
    toolName,
    toolCallId,
  );
  const status = badgeStatus(state, isRunning);
  const isNetwork = metadata?.mode === 'network';
  const toolCalled = isNetwork && metadata?.hasMoreMessages ? true : undefined;
  const agentToolName = stripPrefix(toolName, 'agent-');
  const workflowToolName = stripPrefix(toolName, 'workflow-');

  switch (kind) {
    case 'hidden':
      return null;
    case 'observation': {
      const omData = output?.omData ?? input;
      return (
        <ObservationMarkerBadge
          toolName={toolName}
          args={omData}
          metadata={metadata ? { ...metadata, omData } : undefined}
        />
      );
    }
    case 'ask_user':
      if (!readOnly) {
        return <AskUserTool toolName={toolName} toolCallId={toolCallId} output={output} metadata={metadata} />;
      }
      break;
    case 'submit_plan':
      if (chatAgent) {
        return (
          <SubmitPlanTool
            agentId={chatAgent.agentId}
            agentVersionId={chatAgent.agentVersionId}
            requestContext={chatAgent.requestContext}
            toolName={toolName}
            toolCallId={toolCallId}
            output={output}
            metadata={metadata}
          />
        );
      }
      break;
    case 'background': {
      const isAgent = isAgentCall(metadata, toolName);
      const isWorkflow = isWorkflowCall(metadata, toolName);
      return (
        <ToolBadge
          toolName={isAgent ? agentToolName : isWorkflow ? workflowToolName : toolName}
          args={input}
          result={output}
          toolOutput={[]}
          metadata={metadata}
          toolCallId={toolCallId}
          toolApprovalMetadata={toolApprovalMetadata}
          suspendPayload={suspendedToolMetadata?.suspendPayload}
          isNetwork={isNetwork}
          toolCalled={toolCalled}
          withoutArgs={isAgent || isWorkflow}
          status={status}
        />
      );
    }
    case 'agent':
      return (
        <AgentBadgeWrapper
          agentId={agentToolName}
          result={output}
          metadata={metadata}
          toolCallId={toolCallId}
          toolApprovalMetadata={toolApprovalMetadata}
          toolName={toolName}
          isNetwork={isNetwork}
          suspendPayload={suspendedToolMetadata?.suspendPayload}
          toolCalled={toolCalled}
          isComplete={isSettledState(state)}
          status={status}
          errorText={errorText}
        />
      );
    case 'workflow':
      return (
        <WorkflowBadge
          workflowId={workflowToolName}
          isStreaming={metadata?.mode === 'stream' || isNetwork}
          result={output}
          metadata={metadata}
          toolCallId={toolCallId}
          toolApprovalMetadata={toolApprovalMetadata}
          suspendPayload={suspendedToolMetadata?.suspendPayload}
          toolName={toolName}
          isNetwork={isNetwork}
          toolCalled={toolCalled}
        />
      );
    case 'file_tree':
      return (
        <FileTreeBadge
          toolName={toolName}
          args={input}
          result={output}
          metadata={metadata}
          toolCallId={toolCallId}
          toolApprovalMetadata={toolApprovalMetadata}
          isNetwork={isNetwork}
          toolCalled={toolCalled}
          dataParts={dataParts}
        />
      );
    case 'sandbox':
      return (
        <SandboxExecutionBadge
          toolName={toolName}
          args={input}
          result={output}
          metadata={metadata}
          toolCallId={toolCallId}
          toolApprovalMetadata={toolApprovalMetadata}
          isNetwork={isNetwork}
          toolCalled={toolCalled}
          dataParts={dataParts}
        />
      );
    case 'code_mode': {
      const call = codeModeCall(input, output);
      if (call) {
        return (
          <CodeModeBadge
            toolName={toolName}
            code={call.code}
            result={call.result}
            metadata={metadata}
            toolCallId={toolCallId}
            toolApprovalMetadata={toolApprovalMetadata}
            isNetwork={isNetwork}
            toolCalled={toolCalled}
          />
        );
      }
      break;
    }
    case 'mcp_app':
    case 'plain':
      break;
  }

  const mcpAppInfo = mcpAppTools?.[toolName];

  return (
    <>
      <ToolBadge
        toolName={toolName}
        args={input}
        result={output ?? errorText}
        toolOutput={output?.toolOutput || []}
        metadata={metadata}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        suspendPayload={suspendedToolMetadata?.suspendPayload}
        isNetwork={isNetwork}
        toolCalled={toolCalled}
        status={status}
      />
      {mcpAppInfo && output !== undefined && (
        <McpAppToolResult
          appInfo={mcpAppInfo}
          toolArgs={input}
          toolResult={output}
          onSendMessage={handleMcpAppSendMessage}
          readOnly={readOnly}
        />
      )}
    </>
  );
};
