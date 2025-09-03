import { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/ds/components/Badge';
import { Icon, ToolsIcon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { SyntaxHighlighter } from '../../ui/syntax-highlighter';

export const ToolFallback: ToolCallMessagePartComponent = ({ toolName, argsText, result }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  let argSlot;
  try {
    const parsedArgs = JSON.parse(argsText);
    argSlot = <SyntaxHighlighter data={parsedArgs} />;
  } catch {
    argSlot = <pre className="whitespace-pre-wrap">{argsText}</pre>;
  }

  return (
    <div className="mb-2">
      <button onClick={() => setIsCollapsed(s => !s)} className="flex items-center gap-2">
        <Icon>
          <ChevronUpIcon className={cn('transition-all', isCollapsed ? 'rotate-90' : 'rotate-180')} />
        </Icon>
        <Badge icon={<ToolsIcon className="text-[#ECB047]" />}>{toolName}</Badge>
      </button>

      {!isCollapsed && (
        <div className="pt-2">
          <div className="border-sm border-border1 rounded-lg bg-surface4">
            <div className="px-4 border-b-sm border-border1 py-2">
              <p className="font-medium pb-2">Tool arguments</p>
              {argSlot}
            </div>

            {result !== undefined && (
              <div className="px-4 py-2">
                <p className="font-medium pb-2">Tool result</p>
                {typeof result === 'string' ? (
                  <pre className="whitespace-pre-wrap">{result}</pre>
                ) : (
                  <SyntaxHighlighter data={result} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
