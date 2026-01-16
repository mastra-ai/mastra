import React from 'react';
import { TrashIcon } from 'lucide-react';
import { ArrayElementWrapperProps } from '@autoform/react';
import { Icon } from '@/ds/icons';
import { Button } from '@/ds/components/Button';

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
