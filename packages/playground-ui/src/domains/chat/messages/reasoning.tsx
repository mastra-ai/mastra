import { BrainIcon, ChevronUpIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

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
        <div className="border-border-1 bg-surface4 rounded-lg border p-2">
          <pre className="text-ui-sm leading-ui-sm text-neutral6 whitespace-pre-wrap">{body}</pre>
        </div>
      ) : null}
    </div>
  );
};
