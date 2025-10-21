import { ToolsIcon } from '@/ds/icons';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { Check, X } from 'lucide-react';
import { SyntaxHighlighter } from '../../../ui/syntax-highlighter';
import { BadgeWrapper } from './badge-wrapper';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';
import { MastraUIMessage } from '@mastra/react';

export interface ToolBadgeProps {
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  metadata?: MastraUIMessage['metadata'];
  toolOutput: Array<{ toolId: string }>;
  requiresApproval?: boolean;
  onApprove?: () => void;
  onDecline?: () => void;
  isRunning?: boolean;
  toolCallApprovalStatus?: 'approved' | 'declined';
}

export const ToolBadge = ({
  toolName,
  args,
  result,
  metadata,
  toolOutput,
  requiresApproval,
  onApprove,
  onDecline,
  isRunning,
  toolCallApprovalStatus,
}: ToolBadgeProps) => {
  let argSlot = null;

  try {
    const { __mastraMetadata: _, ...formattedArgs } = typeof args === 'object' ? args : JSON.parse(args);
    argSlot = <SyntaxHighlighter data={formattedArgs} />;
  } catch {
    argSlot = <pre className="whitespace-pre bg-surface4 p-4 rounded-md overflow-x-auto">{args as string}</pre>;
  }

  let resultSlot =
    typeof result === 'string' ? (
      <pre className="whitespace-pre bg-surface4 p-4 rounded-md overflow-x-auto">{result}</pre>
    ) : (
      <SyntaxHighlighter data={result} />
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
      initialCollapsed={!requiresApproval}
    >
      <div className="space-y-4">
        <div>
          <p className="font-medium pb-2">Tool arguments</p>
          {argSlot}
        </div>

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
              <SyntaxHighlighter data={toolOutput} />
            </div>
          </div>
        )}

        {requiresApproval && !toolCalled && (
          <div>
            <p className="font-medium pb-2">Tool approval required</p>
            <div className="flex gap-2 items-center">
              <Button
                onClick={onApprove}
                disabled={isRunning || !!toolCallApprovalStatus}
                className={toolCallApprovalStatus === 'approved' ? '!text-accent1' : ''}
              >
                <Icon>
                  <Check />
                </Icon>
                Approve
              </Button>
              <Button
                onClick={onDecline}
                disabled={isRunning || !!toolCallApprovalStatus}
                className={toolCallApprovalStatus === 'declined' ? '!text-accent2' : ''}
              >
                <Icon>
                  <X />
                </Icon>
                Decline
              </Button>
            </div>
          </div>
        )}
      </div>
    </BadgeWrapper>
  );
};
