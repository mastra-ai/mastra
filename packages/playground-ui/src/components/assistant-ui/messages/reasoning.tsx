import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons';
import { ReasoningContentPart } from '@assistant-ui/react';
import clsx from 'clsx';
import { BrainIcon, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export const Reasoning = ({ text }: ReasoningContentPart) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-2 border-t border-border1 pt-2">
      <Button onClick={() => setIsExpanded(!isExpanded)}>
        <Icon>
          <BrainIcon />
        </Icon>
        Show Reasoning
        <Icon className="ml-2">
          <ChevronDown className={clsx('transition-transform -rotate-90', isExpanded && 'rotate-0')} />
        </Icon>
      </Button>

      {isExpanded ? (
        <div className="rounded-lg bg-surface4 p-2">
          <Txt variant="ui-sm" className="text-icon6">
            {text}
          </Txt>
        </div>
      ) : null}
    </div>
  );
};
