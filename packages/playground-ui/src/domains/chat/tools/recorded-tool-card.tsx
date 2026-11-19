import type { McpAppToolInfo } from '@mastra/react/hooks/mcps';
import { RecordNavigationContext, useRecordNavigation } from '../context/record-navigation';
import type { RecordNavigation } from '../context/record-navigation';
import { AgentBadge } from './badges/agent-badge';
import { CodeModeBadge } from './badges/code-mode-badge';
import { FileTreeBadge } from './badges/file-tree-badge';
import { KnowledgeToolBadge, knowledgeCard } from './badges/knowledge-tool-badge';
import { ObservationMarkerBadge } from './badges/observation-marker-badge';
import { getRecordedSubAgentMessages } from './badges/recorded-sub-agent-messages';
import { SandboxExecutionBadge } from './badges/sandbox-execution-badge';
import { ToolBadge } from './badges/tool-badge';
import { SubmitPlanTool } from './submit-plan-tool';
import type { ToolCardProps } from './tool-card';
import { badgeStatus, codeModeCall, isSettledState, toolCardKind, toolInteraction } from './tool-card-kind';
import { ToolResultMedia } from './tool-result-media';

export interface RecordedToolCardProps extends ToolCardProps {
  /** The MCP app tools of the agent (`useMcpAppTools`), so their calls are told apart; optional. */
  mcpAppTools?: Record<string, McpAppToolInfo>;
}

const NO_RECORD_NAVIGATION: RecordNavigation = {};

const stripPrefix = (toolName: string, prefix: string): string =>
  toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName;

/**
 * A tool call read back from a record (a trace, a stored thread), drawn from what the call recorded and
 * nothing else: no request, no provider, nothing to approve or resume. The sub-agent's answer comes from
 * the call's output, a workflow's from its input and result. `ToolCard` is the live card of a chat; this
 * one renders the same cards wherever the record comes from. Its links (a workspace, a Knowledge page) open
 * through the host's record navigation and show as text without it: never through a Studio route.
 */
export function RecordedToolCard(props: RecordedToolCardProps) {
  const record = useRecordNavigation();
  return (
    <RecordNavigationContext.Provider value={record ?? NO_RECORD_NAVIGATION}>
      <RecordedCall {...props} />
    </RecordNavigationContext.Provider>
  );
}

function RecordedCall({
  toolName,
  input,
  output,
  modelOutput,
  backgroundTaskId,
  backgroundTaskStatus,
  toolCallId,
  state,
  errorText,
  metadata,
  dataParts,
  mcpAppTools,
}: RecordedToolCardProps) {
  const kind = toolCardKind(
    { toolName, toolCallId, input, output, state, backgroundTaskId, backgroundTaskStatus },
    { metadata, mcpAppTools },
  );
  const { approval: toolApprovalMetadata } = toolInteraction(metadata, toolName, toolCallId);
  // A record is settled: nothing of it is still running.
  const status = badgeStatus({ toolName, toolCallId, state }, dataParts, false);
  const isNetwork = metadata?.mode === 'network';
  const toolCalled = isNetwork && metadata?.hasMoreMessages ? true : undefined;
  const shared = { toolName, metadata, toolCallId, toolApprovalMetadata, isNetwork, toolCalled };

  switch (kind) {
    case 'hidden':
      return null;
    case 'observation':
      return <ObservationMarkerBadge toolName={toolName} omData={output?.omData ?? input} />;
    case 'submit_plan':
      // Without the live chat's agent, only a plan its output holds is drawn.
      return <SubmitPlanTool toolName={toolName} toolCallId={toolCallId} output={output} metadata={metadata} />;
    case 'agent':
      return (
        <AgentBadge
          {...shared}
          agentId={stripPrefix(toolName, 'agent-')}
          messages={getRecordedSubAgentMessages(output) ?? []}
          isComplete={isSettledState(state)}
          status={status}
          errorText={errorText}
          renderToolCard={call => <RecordedToolCard {...call} mcpAppTools={mcpAppTools} />}
        />
      );
    case 'workflow':
      return (
        <ToolBadge
          {...shared}
          toolName={stripPrefix(toolName, 'workflow-')}
          args={input}
          result={output}
          toolOutput={[]}
          status={status}
        />
      );
    case 'file_tree':
      return <FileTreeBadge {...shared} args={input} result={output} dataParts={dataParts} status={status} />;
    case 'sandbox':
      return <SandboxExecutionBadge {...shared} args={input} result={output} dataParts={dataParts} status={status} />;
    case 'code_mode': {
      const call = codeModeCall(input, output);
      if (call) return <CodeModeBadge {...shared} code={call.code} result={call.result} />;
      break;
    }
    case 'knowledge': {
      const card = knowledgeCard(toolName, input, output, state === 'output-error' ? (errorText ?? '') : undefined);
      if (card) return <KnowledgeToolBadge {...shared} card={card} args={input} status={status} />;
      break;
    }
    default:
      break;
  }

  return (
    <>
      <ToolBadge
        {...shared}
        args={input}
        result={output ?? errorText}
        toolOutput={output?.toolOutput || []}
        status={status}
        backgroundTaskId={backgroundTaskId}
        backgroundTaskStatus={backgroundTaskStatus}
      />
      <ToolResultMedia modelOutput={modelOutput} />
    </>
  );
}
