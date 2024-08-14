'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils';

export const TextField = ({ className, value, field }: { className?: string; field: any; value: string }) => {
  const [textValue, setTextValue] = useState(value);
  return (
    <Input
      tabIndex={-1}
      className={cn(
        'h-full min-w-[1.2rem] cursor-pointer border-transparent px-3 py-2 !text-sm text-[12px] font-medium focus:outline-0 focus-visible:outline-0 focus-visible:ring-0',
        className,
      )}
      autoComplete="off"
      value={textValue}
      placeholder={`Enter ${field?.displayName || 'value'}`}
      onChange={e => {
        setTextValue(e.target.value);
      }}
    />
  );
};
