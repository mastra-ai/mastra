import { BrainIcon, ChevronUpIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { ReasoningStreamingLine } from './reasoning-streaming-line';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

export interface ReasoningProps {
  text: string;
  redacted?: boolean;
  streaming?: boolean;
}

export const Reasoning = ({ text, redacted, streaming }: ReasoningProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const contentId = useId();

  const body = redacted ? 'Reasoning was redacted by the provider.' : text;

  if (!body.trim()) {
    return streaming ? <ReasoningStreamingLine text="Reasoning..." /> : null;
  }

  return (
    <div className="my-1.5 min-w-0 space-y-1.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
        onClick={() => setIsCollapsed(collapsed => !collapsed)}
        className="gap-2 pointer-coarse:min-h-11"
      >
        <Icon>
          <ChevronUpIcon className={cn('motion-safe:transition-transform', isCollapsed ? 'rotate-90' : 'rotate-180')} />
        </Icon>
        <Badge icon={<BrainIcon />}>{isCollapsed ? 'Show' : 'Hide'} reasoning</Badge>
      </Button>

      <div id={contentId} hidden={isCollapsed} className="border-border min-w-0 border-l-2 pl-2.5 italic [&_p]:my-0.5">
        {!isCollapsed && (
          <MarkdownRenderer className="text-icon3 text-caption" streaming={streaming && !redacted}>
            {body}
          </MarkdownRenderer>
        )}
      </div>
    </div>
  );
};
