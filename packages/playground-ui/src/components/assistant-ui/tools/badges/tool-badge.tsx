import { ToolsIcon } from '@/ds/icons';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { Check, X } from 'lucide-react';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { BadgeWrapper } from './badge-wrapper';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import { MastraUIMessage } from '@mastra/react';
import { ToolApprovalButtons, ToolApprovalButtonsProps } from './tool-approval-buttons';

export interface ToolBadgeProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  metadata?: MastraUIMessage['metadata'];
  toolOutput: Array<{ toolId: string }>;
  suspendPayload?: any;
}

export const ToolBadge = ({
  toolName,
  args,
  result,
  metadata,
  toolOutput,
  toolCallId,
  toolApprovalMetadata,
  suspendPayload,
}: ToolBadgeProps) => {
  let argSlot = null;

  try {
    const { __mastraMetadata: _, ...formattedArgs } = typeof args === 'object' ? args : JSON.parse(args);
    argSlot = <CodeEditor data={formattedArgs} data-testid="tool-args" />;
  } catch {
    argSlot = <pre className="whitespace-pre bg-surface4 p-4 rounded-md overflow-x-auto">{args as string}</pre>;
  }

  let resultSlot =
    typeof result === 'string' ? (
      <pre className="whitespace-pre bg-surface4 p-4 rounded-md overflow-x-auto">{result}</pre>
    ) : (
      <CodeEditor data={result} data-testid="tool-result" />
    );

  let suspendPayloadSlot =
    typeof suspendPayload === 'string' ? (
      <pre className="whitespace-pre bg-surface4 p-4 rounded-md overflow-x-auto">{suspendPayload}</pre>
    ) : (
      <CodeEditor data={suspendPayload} data-testid="tool-suspend-payload" />
    );

  const selectionReason = metadata?.mode === 'network' ? metadata.selectionReason : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? metadata.agentInput : undefined;

  const toolCalled = result || toolOutput.length > 0;

  return (
    <BadgeWrapper
      data-testid="tool-badge"
      icon={<ToolsIcon className="text-[#ECB047]" />}
      title={toolName}
      extraInfo={
        metadata?.mode === 'network' && (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={selectionReason || ''}
            input={agentNetworkInput as string | Record<string, unknown> | undefined}
          />
        )
      }
      initialCollapsed={!!!(toolApprovalMetadata ?? suspendPayload)}
    >
      <div className="space-y-4">
        <div>
          <p className="font-medium pb-2">Tool arguments</p>
          {argSlot}
        </div>

        {suspendPayloadSlot !== undefined && suspendPayload && (
          <div>
            <p className="font-medium pb-2">Tool suspend payload</p>
            {suspendPayloadSlot}
          </div>
        )}

        {resultSlot !== undefined && result && (
          <div>
            <p className="font-medium pb-2">Tool result</p>
            {resultSlot}
          </div>
        )}

        {toolOutput.length > 0 && (
          <div>
            <p className="font-medium pb-2">Tool output</p>

            <div className="h-40 overflow-y-auto">
              <CodeEditor data={toolOutput} data-testid="tool-output" />
            </div>
          </div>
        )}

        <ToolApprovalButtons
          toolCalled={toolCalled}
          toolCallId={toolCallId}
          toolApprovalMetadata={toolApprovalMetadata}
        />
      </div>
    </BadgeWrapper>
  );
};
