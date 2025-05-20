import React from 'react';
import { ObjectWrapperProps } from '@autoform/react';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons';
import { Braces } from 'lucide-react';

export const ObjectWrapper: React.FC<ObjectWrapperProps> = ({ label, children }) => {
  const hasLabel = label !== '\u200B' && label !== '';

  return (
    <div className="">
      {hasLabel && (
        <Txt as="h3" variant="ui-sm" className="text-icon3 flex items-center gap-1 pb-2">
          <Icon size="sm">
            <Braces />
          </Icon>

          {label}
        </Txt>
      )}

      <div
        className={
          hasLabel ? 'flex flex-col gap-1 [&>*]:border-dashed [&>*]:border-l [&>*]:border-l-border1 [&>*]:pl-4' : ''
        }
      >
        {children}
      </div>
    </div>
  );
};
