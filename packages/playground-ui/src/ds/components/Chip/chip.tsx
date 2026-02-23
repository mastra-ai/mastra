import React from 'react';

import { cn } from '@/lib/utils';

const sizeClasses = {
  small: 'text-[11px]   pt-[5px] pb-[4px]',
  default: 'text-[12px] pt-[5px] pb-[4px] ',
  large: 'text-[13px]   pt-[5px] pb-[4px] ',
};

const colorClasses = {
  gray: 'bg-neutral-700/80',
  red: 'bg-red-900',
  orange: 'bg-yellow-900',
  blue: 'bg-cyan-900',
  green: 'bg-green-900',
};

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: 'gray' | 'red' | 'orange' | 'blue' | 'green';
  size?: 'small' | 'default' | 'large';
  children: React.ReactNode;
}

export const Chip = ({ color = 'gray', size = 'default', className, children, ...props }: ChipProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md uppercase text-neutral4 px-[0.6em] gap-[0.4em] font-bold',
        // general styles for svg icons within the chip
        '[&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:translate-y-[-0.02em] [&>svg]:mx-[-0.1em]',
        // if the chip has only one child and it's an svg, make it fully opaque
        '[&>svg]:opacity-50 [&>svg:first-child:last-child]:opacity-100',
        sizeClasses[size],
        colorClasses[color],
        className,
      )}
      style={{ lineHeight: 1 }}
      {...props}
    >
      {children}
    </span>
  );
};
