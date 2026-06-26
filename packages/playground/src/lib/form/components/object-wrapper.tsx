import type { ObjectWrapperProps } from '@autoform/react';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Braces, ChevronDownIcon } from 'lucide-react';
import React, { useState } from 'react';

export const ObjectWrapper: React.FC<ObjectWrapperProps> = ({ label, children }) => {
  const hasLabel = label !== '\u200B' && label !== '';
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="">
      <div className="flex items-center">
        {hasLabel && (
          <Txt as="h3" variant="ui-sm" className="text-neutral3 flex items-center gap-1 pb-2">
            <Icon size="sm">
              <Braces />
            </Icon>

            {label}
          </Txt>
        )}

        <Button onClick={() => setIsOpen(!isOpen)} type="button" className="ml-auto px-1" size="sm">
          <Icon size="sm">
            <ChevronDownIcon className={cn('transition-all', isOpen ? 'rotate-180' : 'rotate-0')} />
          </Icon>
        </Button>
      </div>

      {isOpen && (
        <div className={hasLabel ? 'flex flex-col gap-1 *:border-dashed *:border-l *:border-l-border1 *:pl-4' : ''}>
          {children}
        </div>
      )}
    </div>
  );
};
