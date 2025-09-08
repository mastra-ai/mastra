import { ToolsIcon } from '@/ds/icons';
import { SyntaxHighlighter } from '../../../ui/syntax-highlighter';
import { BadgeWrapper } from './badge-wrapper';

export interface ToolBadgeProps {
  toolName: string;
  argsText: string;
  result: any;
}

export const ToolBadge = ({ toolName, argsText, result }: ToolBadgeProps) => {
  let argSlot;

  try {
    const parsedArgs = JSON.parse(argsText);
    argSlot = <SyntaxHighlighter data={parsedArgs} />;
  } catch {
    argSlot = <pre className="whitespace-pre-wrap">{argsText}</pre>;
  }

  return (
    <BadgeWrapper icon={<ToolsIcon className="text-[#ECB047]" />} title={toolName}>
      <>
        <div className="border-b-sm border-border1 py-2">
          <p className="font-medium pb-2">Tool arguments</p>
          {argSlot}
        </div>
        {result !== undefined && (
          <div className="py-2">
            <p className="font-medium pb-2">Tool result</p>
            {typeof result === 'string' ? (
              <pre className="whitespace-pre-wrap">{result}</pre>
            ) : (
              <SyntaxHighlighter data={result} />
            )}
          </div>
        )}
      </>
    </BadgeWrapper>
  );
};
