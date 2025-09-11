import { ToolsIcon } from '@/ds/icons';
import { SyntaxHighlighter } from '../../../ui/syntax-highlighter';
import { BadgeWrapper } from './badge-wrapper';
import { NetworkChoiceMetadataDialogTrigger } from './network-choice-metadata-dialog';

export interface ToolBadgeProps {
  toolName: string;
  argsText: string;
  result: any;
  networkMetadata?: {
    input?: string | Record<string, unknown>;
    selectionReason?: string;
  };
}

export const ToolBadge = ({ toolName, argsText, result, networkMetadata }: ToolBadgeProps) => {
  let argSlot;

  try {
    const { __mastraMetadata: _, ...rest } = JSON.parse(argsText);
    argSlot = <SyntaxHighlighter data={rest} />;
  } catch {
    argSlot = <pre className="whitespace-pre-wrap">{argsText}</pre>;
  }

  let resultSlot;
  try {
    const parsedResult = JSON.parse(result);
    resultSlot = <SyntaxHighlighter data={parsedResult} />;
  } catch {
    resultSlot = <pre className="whitespace-pre-wrap">{result}</pre>;
  }

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
