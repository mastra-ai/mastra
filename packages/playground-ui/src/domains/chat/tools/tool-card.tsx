import { useMcpAppTools } from '@mastra/react/hooks/mcps';
import { useCallback, useContext, useMemo } from 'react';
import { BackgroundCommandBadge } from '../background/background-command-badge';
import { backgroundProcessPid } from '../background/background-process';
import { useChatBackgroundWork } from '../background/use-chat-background-work';
import { AgentBadgeWrapper } from './badges/agent-badge-wrapper';
import { FileTreeBadge } from './badges/file-tree-badge';
import { KnowledgeToolBadge, knowledgeCard } from './badges/knowledge-tool-badge';
import { DeferredMcpInputRequest, ForegroundMcpInputRequest } from './badges/mcp-input-request-badge';
import { SandboxExecutionBadge } from './badges/sandbox-execution-badge';
import { ToolBadge } from './badges/tool-badge';
import { useBackgroundTaskStatus } from './badges/use-background-task-status';
import { useDeferredInputRequest } from './badges/use-deferred-input-request';
import { useWorkflowStream, WorkflowBadge } from './badges/workflow-badge';
import { suspendedMcpInputRequest } from './mcp-input-request';
import { SubmitPlanTool } from './submit-plan-tool';
import { ToolResultMedia } from './tool-result-media';
import type { MessageMetadata } from '@/domains/chat';
import {
  ChatAgentContext,
  useChatModelContext,
  useChatRunning,
  useChatSend,
  useChatThreadId,
} from '@/domains/chat/context/chat-context';
import { AskUserTool } from '@/domains/chat/tools/ask-user-tool';
import { CodeModeBadge } from '@/domains/chat/tools/badges/code-mode-badge';
import { ObservationMarkerBadge } from '@/domains/chat/tools/badges/observation-marker-badge';
import { ConnectPromptTool } from '@/domains/chat/tools/connect-prompt-tool';
import {
  badgeStatus,
  codeModeCall,
  isAgentCall,
  isDeferredCall,
  isStoppedBackgroundCall,
  isSettledState,
  isWorkflowCall,
  toolCardKind,
  toolInteraction,
} from '@/domains/chat/tools/tool-card-kind';
import { McpAppToolResult } from '@/domains/mcps/components/mcp-app-tool-result';
import { PlaygroundWorkflowRunProvider } from '@/domains/workflows/context/playground-workflow-run-provider';

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
  modelOutput?: unknown;
  /** The Mastra background task running the call, when it was deferred. */
  backgroundTaskId?: string;
  /** The background task's status in the part's metadata: `running` until the part holds its result. */
  backgroundTaskStatus?: string;
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
    <PlaygroundWorkflowRunProvider workflowId="" withoutTimeTravel>
      <ToolCardInner {...props} />
    </PlaygroundWorkflowRunProvider>
  );
};

export const ToolCardInner = ({
  toolName,
  input,
  output,
  modelOutput,
  backgroundTaskId,
  backgroundTaskStatus: partBackgroundTaskStatus,
  toolCallId,
  state,
  errorText,
  metadata,
  dataParts,
  readOnly = false,
}: ToolCardProps) => {
  const { data: mcpAppTools } = useMcpAppTools();
  const backgroundTaskStatus = useBackgroundTaskStatus(backgroundTaskId, partBackgroundTaskStatus);
  const backgroundWork = useChatBackgroundWork();
  const threadId = useChatThreadId();
  const send = useChatSend();
  const chatAgent = useContext(ChatAgentContext);
  const { isRunning } = useChatRunning();
  const handleMcpAppSendMessage = useCallback(
    (content: string) => {
      void send({ message: content });
    },
    [send],
  );
  const setModelContext = useChatModelContext();
  const handleMcpAppModelContext = useMemo(
    () => setModelContext && ((context: string | undefined) => setModelContext(toolCallId, context)),
    [setModelContext, toolCallId],
  );
  useWorkflowStream(output);

  const kind = toolCardKind(
    { toolName, toolCallId, input, output, state, backgroundTaskId, backgroundTaskStatus },
    { metadata, mcpAppTools },
  );
  const { approval: toolApprovalMetadata, suspended: suspendedToolMetadata } = toolInteraction(
    metadata,
    toolName,
    toolCallId,
  );
  // A stopped call's task can't be resumed, though its suspension may outlive it in the metadata.
  const suspendPayload = isStoppedBackgroundCall(backgroundTaskId, backgroundTaskStatus)
    ? undefined
    : suspendedToolMetadata?.suspendPayload;
  const status = badgeStatus({ toolName, toolCallId, state }, dataParts, isRunning);
  // Any deferred call, whatever its output looks like: live it holds the MCP task's progress records,
  // after a reload the "Background task started" placeholder.
  const deferredRequest = useDeferredInputRequest(
    backgroundTaskId ?? '',
    isDeferredCall(backgroundTaskId, backgroundTaskStatus) && !readOnly,
  );
  const isNetwork = metadata?.mode === 'network';
  const toolCalled = isNetwork && metadata?.hasMoreMessages ? true : undefined;
  const agentToolName = stripPrefix(toolName, 'agent-');
  const workflowToolName = stripPrefix(toolName, 'workflow-');
  const deferredCard = deferredRequest && backgroundTaskId && (
    <DeferredMcpInputRequest
      key={String(deferredRequest.suspendedAt)}
      backgroundTaskId={backgroundTaskId}
      request={deferredRequest}
    />
  );

  const body = renderKind();
  // A deferred call's question shows under whichever badge draws the call. One fragment either way, so
  // the badge (and its task progress) isn't remounted when the question comes and goes.
  return (
    <>
      {body}
      {body !== null && deferredCard}
    </>
  );

  function renderKind() {
    switch (kind) {
      case 'hidden':
        return null;
      case 'observation':
        return <ObservationMarkerBadge toolName={toolName} omData={output?.omData ?? input} />;
      case 'ask_user':
        if (!readOnly) {
          return <AskUserTool toolName={toolName} toolCallId={toolCallId} output={output} metadata={metadata} />;
        }
        break;
      case 'connect_prompt':
        return (
          <ConnectPromptTool
            toolName={toolName}
            toolCallId={toolCallId}
            output={output}
            metadata={metadata}
            readOnly={readOnly}
          />
        );
      case 'submit_plan':
        return (
          <SubmitPlanTool
            agentId={chatAgent?.agentId}
            agentVersionId={chatAgent?.agentVersionId}
            requestContext={chatAgent?.requestContext}
            toolName={toolName}
            toolCallId={toolCallId}
            output={output}
            metadata={metadata}
          />
        );
      case 'mcp_input_request': {
        const payload = suspendedMcpInputRequest(metadata, toolCallId);
        if (!payload) break;
        return (
          <>
            <ToolBadge
              toolName={toolName}
              args={input}
              result={output}
              toolOutput={[]}
              metadata={metadata}
              toolCallId={toolCallId}
              toolApprovalMetadata={toolApprovalMetadata}
              isNetwork={isNetwork}
              toolCalled={toolCalled}
              status={status}
              mcpInputRequest={payload}
            />
            {/* The card stays mounted across a call's suspensions, so a new one must start with no answers. */}
            <ForegroundMcpInputRequest
              key={payload.requestedAt ?? payload.createdAt}
              toolCallId={toolCallId}
              payload={payload}
              readOnly={readOnly}
              isNetwork={isNetwork}
            />
          </>
        );
      }
      case 'background': {
        const isAgent = isAgentCall(metadata, toolName);
        const isWorkflow = isWorkflowCall(metadata, toolName);
        return (
          <>
            <ToolBadge
              toolName={isAgent ? agentToolName : isWorkflow ? workflowToolName : toolName}
              args={input}
              result={output}
              toolOutput={[]}
              metadata={metadata}
              toolCallId={toolCallId}
              toolApprovalMetadata={toolApprovalMetadata}
              suspendPayload={suspendPayload}
              isNetwork={isNetwork}
              toolCalled={toolCalled}
              withoutArgs={isAgent || isWorkflow}
              status={status}
              backgroundTaskId={backgroundTaskId}
              backgroundTaskStatus={backgroundTaskStatus}
              mcpInputRequest={deferredRequest?.payload}
            />
          </>
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
            status={status}
          />
        );
      case 'background_command': {
        const pid = backgroundProcessPid(toolName, input, output);
        if (pid && backgroundWork && threadId) {
          return (
            <BackgroundCommandBadge
              toolName={toolName}
              toolCallId={toolCallId}
              args={input}
              result={output}
              pid={pid}
              dataParts={dataParts}
              work={backgroundWork}
              threadId={threadId}
              toolApprovalMetadata={toolApprovalMetadata}
              isNetwork={isNetwork}
              isGenerateMode={metadata?.mode === 'generate'}
            />
          );
        }
        // Outside a chat that tracks its background work (Agent Builder, traces), it draws as the call it was.
        // falls through
      }
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
            status={status}
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
      case 'knowledge': {
        const card = knowledgeCard(toolName, input, output, state === 'output-error' ? (errorText ?? '') : undefined);
        if (card) {
          return (
            <KnowledgeToolBadge
              card={card}
              args={input}
              toolName={toolName}
              metadata={metadata}
              toolCallId={toolCallId}
              toolApprovalMetadata={toolApprovalMetadata}
              isNetwork={isNetwork}
              status={status}
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
          suspendPayload={suspendPayload}
          isNetwork={isNetwork}
          toolCalled={toolCalled}
          status={status}
          backgroundTaskId={backgroundTaskId}
          backgroundTaskStatus={backgroundTaskStatus}
          mcpInputRequest={deferredRequest?.payload}
        />
        <ToolResultMedia modelOutput={modelOutput} />
        {mcpAppInfo && output !== undefined && (
          <McpAppToolResult
            appInfo={mcpAppInfo}
            toolArgs={input}
            toolResult={output}
            toolCallId={toolCallId}
            onSendMessage={handleMcpAppSendMessage}
            onUpdateModelContext={handleMcpAppModelContext}
            readOnly={readOnly}
          />
        )}
      </>
    );
  }
};
