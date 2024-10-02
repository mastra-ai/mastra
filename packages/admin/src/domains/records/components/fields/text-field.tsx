'use client';

import { Property } from '@mastra/core';
import { useState } from 'react';

import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils';

export const TextField = ({
  className,
  value,
  property,
}: {
  className?: string;
  property: Property;
  value: string;
}) => {
  const [textValue, setTextValue] = useState(value);

  return (
    <Input
      tabIndex={-1}
      className={cn(
        'h-full min-w-[1.2rem] cursor-pointer border-transparent font-normal px-3 py-2 text-[12px] focus:outline-0 focus-visible:outline-0 focus-visible:ring-0',
        className,
      )}
      autoComplete="off"
      value={textValue}
      onChange={e => {
        setTextValue(e.target.value);
      }}
    />
  );
};
