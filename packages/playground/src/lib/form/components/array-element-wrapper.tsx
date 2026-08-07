import type { ArrayElementWrapperProps } from '@autoform/react';
import { Button } from '@mastra/playground-ui/components/Button';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { TrashIcon } from 'lucide-react';
import React from 'react';

export const ArrayElementWrapper: React.FC<ArrayElementWrapperProps> = ({ children, onRemove }) => {
  return (
    <div className="border-border1 border-l pl-4">
      {children}
      <Button onClick={onRemove} type="button">
        <Icon size="sm">
          <TrashIcon />
        </Icon>
        Delete
      </Button>
    </div>
  );
};
