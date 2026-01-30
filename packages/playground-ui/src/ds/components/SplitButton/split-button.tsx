'use client';

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/ds/components/Popover';
import { CombinedButtons } from '@/ds/components/CombinedButtons';
import { Button, type ButtonProps } from '@/ds/components/Button';
import { ChevronDown } from 'lucide-react';
import type { FormElementSize } from '@/ds/primitives/form-element';

export interface SplitButtonProps {
  mainLabel: React.ReactNode;
  onMainClick: () => void;
  variant?: ButtonProps['variant'];
  size?: FormElementSize;
  children: React.ReactNode;
  disabled?: boolean;
  dropdownAlign?: 'start' | 'center' | 'end';
  className?: string;
}

export const SplitButton = ({
  mainLabel,
  onMainClick,
  variant = 'default',
  size = 'md',
  children,
  disabled = false,
  dropdownAlign = 'end',
  className,
}: SplitButtonProps) => {
  const [open, setOpen] = useState(false);

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <CombinedButtons className={className}>
      <Button variant={variant} size={size} disabled={disabled} onClick={onMainClick}>
        {mainLabel}
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant={variant} size={size} disabled={disabled}>
            <ChevronDown className={iconSize} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align={dropdownAlign}>{children}</PopoverContent>
      </Popover>
    </CombinedButtons>
  );
};
