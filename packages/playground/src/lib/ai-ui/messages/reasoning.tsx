import { Icon, cn } from '@mastra/playground-ui';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { BrainIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';

export interface ReasoningProps {
  text: string;
  redacted?: boolean;
}

export const Reasoning = ({ text, redacted }: ReasoningProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const body = redacted ? 'Reasoning was redacted by the provider.' : text;

  if (!body) {
    return null;
  }

  return (
    <div className="mb-2 space-y-2">
      <button onClick={() => setIsCollapsed(s => !s)} className="flex items-center gap-2">
        <Icon>
          <ChevronUpIcon className={cn('transition-all', isCollapsed ? 'rotate-90' : 'rotate-180')} />
        </Icon>
        <Badge icon={<BrainIcon />}>{isCollapsed ? 'Show' : 'Hide'} reasoning</Badge>
      </button>

      {!isCollapsed ? (
        <div className="rounded-lg bg-surface4 p-2 border border-border-1">
          <pre className="whitespace-pre-wrap text-ui-sm leading-ui-sm text-neutral6">{body}</pre>
        </div>
      ) : null}
    </div>
  );
};
