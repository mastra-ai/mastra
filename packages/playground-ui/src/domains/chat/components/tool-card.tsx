import { AskUser, AskUserContainer, AskUserOutput } from '../../../ds/components/ai/ask-user';
import type { AskUserPayload, AskUserResult } from '../../../ds/components/ai/ask-user';
import { Skeleton } from '../../../ds/components/Skeleton';
import { Spinner } from '../../../ds/components/Spinner';
import type { MessageMetadata } from '../messages/message-metadata';
import { isRecord } from '../messages/signal-data';
import { AgentMessageView } from './agent-message';
import { resolveAgentMessages } from './agent-messages';
import type { ChatToolContext } from './chat-tool-context';
import { CodeModeMessage } from './code-mode-message';
import { FileTreeMessage } from './file-tree-message';
import { McpAppViewer } from './mcp-app-viewer';
import { ObservationMarkerBadge } from './observation-marker-badge';
import { PendingPlanCard, SubmittedPlanCard } from './plan-card';
import { getPlanDocument } from './plan-document';
import { SandboxExecutionMessage } from './sandbox-execution-message';
import { ToolBadgeDisclosure } from './tool-badge-disclosure';
import {
  badgeStatus,
  codeModeCall,
  isAgentCall,
  isSettledState,
  isWorkflowCall,
  toolCardKind,
  toolInteraction,
} from './tool-card-kind';
import type { DataMessagePart } from './tool-data';
import { ToolMessage } from './tool-message';
import { WorkflowMessage } from './workflow-message';
export type { DataMessagePart } from './tool-data';

export interface ToolCardProps extends ChatToolContext {
  toolName: string;
  toolCallId: string;
  input: any;
  output: any;
  state?: string;
  metadata?: MessageMetadata;
  dataParts?: ReadonlyArray<DataMessagePart>;
}

export function ToolCard({ toolName, toolCallId, input, output, state, metadata, dataParts, ...tools }: ToolCardProps) {
  const {
    isRunning,
    toolData,
    onApprove,
    onDecline,
    onAnswer,
    onApprovePlan,
    onRejectPlan,
    onNavigate,
    onToolOpen,
    onMcpToolCall,
    onMcpSendMessage,
  } = tools;
  const data = toolData?.[toolCallId];
  const action = { toolName, toolCallId, metadata };
  const { approval, suspended } = toolInteraction(metadata, toolName, toolCallId);
  const isNetwork = metadata?.mode === 'network';
  const toolCalled = isNetwork && metadata?.hasMoreMessages ? true : undefined;
  const controls = {
    isRunning: data?.isSubmitting ?? isRunning,
    status: data?.approvalStatus,
    onApprove: onApprove ? () => onApprove(action) : undefined,
    onDecline: onDecline ? () => onDecline(action) : undefined,
    approvalRequired: !!approval,
    toolCallId,
    toolCalled,
    onToolOpen,
  };
  const common = { ...controls, toolName, args: input, result: output, dataParts, onNavigate };
  const kind = toolCardKind(
    { toolName, toolCallId, input, output, state },
    { metadata, mcpAppTools: tools.mcpAppTools },
  );
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
    case 'ask_user': {
      const rawPayload = suspended?.suspendPayload;
      if (!isRecord(rawPayload) || typeof rawPayload.question !== 'string') return null;
      const payload: AskUserPayload = {
        question: rawPayload.question,
        options: Array.isArray(rawPayload.options) ? rawPayload.options : undefined,
        selectionMode: rawPayload.selectionMode === 'multi_select' ? 'multi_select' : 'single_select',
      };
      const result: AskUserResult | undefined = output && typeof output.content === 'string' ? output : undefined;
      if (!onAnswer)
        return (
          <AskUserContainer data-testid="ask-user">
            <p className="text-neutral6 mb-2 font-medium">{payload.question}</p>
            {result && <AskUserOutput result={result} />}
          </AskUserContainer>
        );
      return (
        <AskUser
          payload={payload}
          result={result}
          isAnswered={data?.approvalStatus !== undefined}
          isSubmitting={controls.isRunning}
          onSubmit={answer => onAnswer(action, answer)}
        />
      );
    }
    case 'submit_plan': {
      const submitted = output?.submittedPlan;
      if (isRecord(submitted) && typeof submitted.plan === 'string' && submitted.plan.length > 0) {
        const document = getPlanDocument(submitted.plan);
        return (
          <SubmittedPlanCard
            plan={{
              content: submitted.plan,
              title: typeof submitted.title === 'string' && submitted.title ? submitted.title : document.title,
              path: typeof submitted.path === 'string' ? submitted.path : undefined,
            }}
          />
        );
      }
      const path = isRecord(suspended?.suspendPayload) ? suspended.suspendPayload.path : undefined;
      if (typeof path !== 'string' || !path) return null;
      return (
        <PendingPlanCard
          path={path}
          {...data?.plan}
          isRunning={controls.isRunning}
          isAnswered={data?.approvalStatus !== undefined}
          onApprove={onApprovePlan ? () => onApprovePlan(action, path) : undefined}
          onReject={onRejectPlan ? () => onRejectPlan(action, path) : undefined}
        />
      );
    }
    case 'agent': {
      if (data?.agent?.isLoading)
        return (
          <ToolBadgeDisclosure
            isRunning={isRunning}
            icon={<Spinner className="text-neutral3" />}
            title={<Skeleton className="ml-2 h-2 w-12" />}
            collapsible={false}
          />
        );
      const childMessages = resolveAgentMessages(output, data?.agent?.messages);
      return (
        <AgentMessageView
          {...controls}
          agentId={toolName.replace(/^agent-/, '')}
          messages={childMessages}
          metadata={metadata}
          isNetwork={isNetwork}
          suspendPayload={suspended?.suspendPayload}
          isComplete={isSettledState(state)}
          keepOpenForStreamingChildMessages={Boolean(
            output && Object.prototype.hasOwnProperty.call(output, 'childMessages'),
          )}
          backgroundTaskDetails={data?.backgroundTask}
          tools={tools}
        />
      );
    }
    case 'workflow':
      return (
        <WorkflowMessage
          {...controls}
          workflowId={toolName.replace(/^workflow-/, '')}
          result={output}
          metadata={metadata}
          data={data?.workflow}
          isStreaming={metadata?.mode === 'stream' || isNetwork}
          suspendPayload={suspended?.suspendPayload}
          onNavigate={onNavigate}
          backgroundTaskDetails={data?.backgroundTask}
        />
      );
    case 'file_tree':
      return <FileTreeMessage {...common} />;
    case 'sandbox':
      return <SandboxExecutionMessage {...common} />;
    case 'code_mode': {
      const call = codeModeCall(input, output);
      if (call) return <CodeModeMessage {...controls} toolName={toolName} {...call} />;
      break;
    }
  }
  const backgroundAgent = kind === 'background' && isAgentCall(metadata, toolName);
  const backgroundWorkflow = kind === 'background' && isWorkflowCall(metadata, toolName);
  return (
    <>
      <ToolMessage
        {...common}
        toolName={
          backgroundAgent
            ? toolName.replace(/^agent-/, '')
            : backgroundWorkflow
              ? toolName.replace(/^workflow-/, '')
              : toolName
        }
        metadata={metadata}
        toolOutput={kind === 'background' ? [] : output?.toolOutput || []}
        suspendPayload={suspended?.suspendPayload}
        toolStatus={badgeStatus(state, isRunning)}
        backgroundTaskDetails={data?.backgroundTask}
        withoutArgs={backgroundAgent || backgroundWorkflow}
      />
      {tools.mcpAppTools?.[toolName] &&
        output !== undefined &&
        (data?.mcpApp?.isLoading ? (
          <div className="text-neutral3 py-2 text-sm">Loading MCP App UI…</div>
        ) : data?.mcpApp?.html ? (
          <McpAppViewer
            {...data.mcpApp}
            toolName={toolName}
            toolInput={input}
            toolResult={output}
            onToolCall={onMcpToolCall ? (name, args) => onMcpToolCall(action, name, args) : undefined}
            onSendMessage={onMcpSendMessage ? text => onMcpSendMessage(action, text) : undefined}
          />
        ) : null)}
    </>
  );
}
