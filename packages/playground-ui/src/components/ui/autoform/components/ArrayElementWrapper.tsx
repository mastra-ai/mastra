import React from 'react';
import { Button } from '@/components/ui/button';
import { TrashIcon } from 'lucide-react';
import { ArrayElementWrapperProps } from '@autoform/react';

export const ArrayElementWrapper: React.FC<ArrayElementWrapperProps> = ({ children, onRemove }) => {
  return (
    <div className="relative border p-4 rounded-md mt-2">
      <Button onClick={onRemove} variant="ghost" className="absolute top-2 right-2" type="button">
        <TrashIcon className="h-4 w-4" />
      </Button>
      {children}
    </div>
  );
};
