import { ToolsIcon } from '@/ds/icons';
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
}

export const ToolBadge = ({ toolName, args, result, metadata, toolOutput }: ToolBadgeProps) => {
  let argSlot = null;

  try {
    const { __mastraMetadata: _, ...formattedArgs } = typeof args === 'object' ? args : JSON.parse(args);
    argSlot = <SyntaxHighlighter data={formattedArgs} />;
  } catch {
    argSlot = <pre className="whitespace-pre-wrap">{args as string}</pre>;
  }

  let resultSlot =
    typeof result === 'string' ? (
      <pre className="whitespace-pre-wrap bg-surface4 p-4 rounded-md">{result}</pre>
    ) : (
      <SyntaxHighlighter data={result} />
    );

  const selectionReason = metadata?.mode === 'network' ? metadata.selectionReason : undefined;
  const agentNetworkInput = metadata?.mode === 'network' ? metadata.agentInput : undefined;

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
    >
      <div className="space-y-4">
        <div>
          <p className="font-medium pb-2">Tool arguments</p>
          {argSlot}
        </div>

        {resultSlot !== undefined && (
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
      </div>
    </BadgeWrapper>
  );
};
