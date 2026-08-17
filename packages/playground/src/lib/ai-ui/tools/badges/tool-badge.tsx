import { ToolCall } from '@mastra/playground-ui/components/ai/tool-call';
import type { ToolCallStatus } from '@mastra/playground-ui/components/ai/tool-call';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { BackgroundTaskMetadataDialogTrigger } from './background-task-metadata-dialog';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { ToolApprovalButtons } from './tool-approval-buttons';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

export interface ToolBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  state?: string;
  metadata?: MessageMetadata;
  toolOutput: Array<{ toolId: string }>;
  suspendPayload?: any;
  toolCalled?: boolean;
  withoutArgs?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

function parseArgs(args: ToolBadgeProps['args']): unknown {
  let parsed: unknown = args;

  if (typeof args === 'string') {
    try {
      parsed = JSON.parse(args);
    } catch {
      return args;
    }
  }

  if (!isRecord(parsed)) return parsed;

  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) => key !== '__mastraMetadata' && key !== '_background'),
  );
}

function toolStatus(state: string | undefined, result: unknown): ToolCallStatus {
  if (state === 'error' || state === 'output-error' || state === 'output-denied') return 'error';
  if (state === 'result' || state === 'output-available' || result !== undefined) return 'success';
  return 'running';
}

function networkDialogInput(value: unknown): string | Record<string, unknown> | undefined {
  if (typeof value === 'string' || isRecord(value)) return value;
  return undefined;
}

function SuspendPayload({ value }: { value: unknown }) {
  if (isRecord(value) || isRecordArray(value)) {
    return <CodeEditor data={value} data-testid="tool-suspend-payload" />;
  }

  return <pre className="bg-surface4 overflow-x-auto rounded-md p-4 whitespace-pre">{String(value)}</pre>;
}

export const ToolBadge = ({
  toolName,
  args,
  result,
  state,
  metadata,
  toolOutput,
  toolCallId,
  toolApprovalMetadata,
  suspendPayload,
  isNetwork,
  toolCalled: toolCalledProp,
  withoutArgs,
}: ToolBadgeProps) => {
  const routingDecision = metadata?.mode === 'network' ? metadata.routingDecision : undefined;
  const selectionReason =
    metadata?.mode === 'network' ? (routingDecision?.selectionReason ?? metadata.selectionReason) : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? (routingDecision ?? metadata.agentInput) : undefined;
  const toolCalled = toolCalledProp ?? Boolean(result || toolOutput.length > 0);

  const bgEntry =
    (metadata?.mode === 'stream' || metadata?.mode === 'generate') && metadata.backgroundTasks
      ? metadata.backgroundTasks[toolCallId]
      : undefined;

  const headerActions =
    metadata?.mode === 'network' ? (
      <NetworkChoiceMetadataDialogTrigger
        selectionReason={selectionReason || ''}
        input={networkDialogInput(agentNetworkInput)}
      />
    ) : bgEntry?.taskId && bgEntry.startedAt ? (
      <BackgroundTaskMetadataDialogTrigger backgroundTask={bgEntry} />
    ) : undefined;

  return (
    <ToolCall
      data-testid="tool-badge"
      toolName={toolName}
      input={withoutArgs ? undefined : parseArgs(args)}
      result={result}
      status={toolStatus(state, result)}
      defaultOpen={Boolean(toolApprovalMetadata ?? suspendPayload)}
      headerActions={headerActions}
    >
      {Boolean(suspendPayload) && (
        <div>
          <p className="pb-2 font-medium">Tool suspend payload</p>
          <SuspendPayload value={suspendPayload} />
        </div>
      )}

      {toolOutput.length > 0 && (
        <div>
          <p className="pb-2 font-medium">Tool output</p>
          <div className="h-40 overflow-y-auto">
            <CodeEditor data={toolOutput} data-testid="tool-output" />
          </div>
        </div>
      )}

      <ToolApprovalButtons
        toolCalled={toolCalled}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        toolName={toolName}
        isNetwork={isNetwork}
        isGenerateMode={metadata?.mode === 'generate'}
      />
    </ToolCall>
  );
};
