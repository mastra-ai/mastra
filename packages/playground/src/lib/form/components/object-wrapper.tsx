import type { ObjectWrapperProps } from '@autoform/react';
import { Button, Txt, Icon, cn } from '@mastra/playground-ui';
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
