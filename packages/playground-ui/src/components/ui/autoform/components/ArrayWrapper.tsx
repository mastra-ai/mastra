import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';
import { ArrayWrapperProps } from '@autoform/react';

export const ArrayWrapper: React.FC<ArrayWrapperProps> = ({ label, children, onAddItem }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{label}</h3>
      {children}
      <Button
        className="w-full flex items-center justify-center"
        onClick={onAddItem}
        variant="outline"
        size="sm"
        type="button"
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};
