import { ToolsIcon } from '@/ds/icons';
import { SyntaxHighlighter } from '../../../ui/syntax-highlighter';
import { BadgeWrapper } from './badge-wrapper';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';

export interface ToolBadgeProps {
  toolName: string;
  args: Record<string, unknown> | string;
  result: any;
  networkMetadata?: {
    input?: string | Record<string, unknown>;
    selectionReason?: string;
  };
}

export const ToolBadge = ({ toolName, args, result, networkMetadata }: ToolBadgeProps) => {
  let argSlot = null;

  try {
    const { __mastraMetadata: _, ...formattedArgs } = typeof args === 'object' ? args : JSON.parse(args);
    argSlot = <SyntaxHighlighter data={formattedArgs} />;
  } catch {
    argSlot = <pre className="whitespace-pre-wrap">{args as string}</pre>;
  }

  let resultSlot =
    typeof result === 'string' ? (
      <pre className="whitespace-pre-wrap">{result}</pre>
    ) : (
      <SyntaxHighlighter data={result} />
    );

  return (
    <BadgeWrapper
      icon={<ToolsIcon className="text-[#ECB047]" />}
      title={toolName}
      extraInfo={
        networkMetadata && (
          <NetworkChoiceMetadataDialogTrigger
            selectionReason={networkMetadata?.selectionReason || ''}
            input={networkMetadata?.input}
          />
        )
      }
    >
      <div className="space-y-4">
        <div>
          <p className="font-medium pb-2">Tool arguments</p>
          {argSlot}
        </div>

        {result !== undefined && (
          <div>
            <p className="font-medium pb-2">Tool result</p>
            {resultSlot}
          </div>
        )}
      </div>
    </BadgeWrapper>
  );
};
