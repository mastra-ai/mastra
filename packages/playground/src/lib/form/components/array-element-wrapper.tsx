import type { ArrayElementWrapperProps } from '@autoform/react';
import { Button, Icon } from '@mastra/playground-ui';
import { TrashIcon } from 'lucide-react';
import React from 'react';

export const ArrayElementWrapper: React.FC<ArrayElementWrapperProps> = ({ children, onRemove }) => {
  return (
    <div className="pl-4 border-l border-border1">
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
