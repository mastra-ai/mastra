import React from 'react';

import { cn } from '@/lib/utils';

const sizeClasses = {
  small: 'text-[11px]   pt-[5px] pb-[4px]',
  default: 'text-[12px] pt-[5px] pb-[4px] ',
  large: 'text-[13px]   pt-[5px] pb-[4px] ',
};

const bgColorClasses = {
  gray: { bright: 'bg-neutral-700', muted: 'bg-neutral-700/80' },
  red: { bright: 'bg-red-900', muted: 'bg-red-900/80' },
  orange: { bright: 'bg-yellow-900', muted: 'bg-yellow-900/80' },
  blue: { bright: 'bg-blue-800', muted: 'bg-blue-800/80' },
  green: { bright: 'bg-green-900', muted: 'bg-green-900/80' },
  purple: { bright: 'bg-purple-900', muted: 'bg-purple-900/80' },
  yellow: { bright: 'bg-yellow-700', muted: 'bg-yellow-700/80' },
  cyan: { bright: 'bg-cyan-900', muted: 'bg-cyan-900/80' },
  pink: { bright: 'bg-pink-900', muted: 'bg-pink-900/80' },
};

const txtIntensityClasses = {
  bright: 'text-neutral4',
  muted: 'text-neutral3',
};

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: 'gray' | 'red' | 'orange' | 'blue' | 'green' | 'purple' | 'yellow' | 'cyan' | 'pink';
  size?: 'small' | 'default' | 'large';
  intensity?: 'bright' | 'muted';
  children: React.ReactNode;
}

export const Chip = ({
  color = 'gray',
  size = 'default',
  intensity = 'bright',
  className,
  children,
  ...props
}: ChipProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md uppercase px-[0.6em] gap-[0.4em] tracking-wide font-normal',
        // general styles for svg icons within the chip
        '[&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:translate-y-[-0.02em] [&>svg]:mx-[-0.2em]',
        // if the chip has only one child and it's an svg, make it fully opaque
        '[&>svg]:opacity-50 [&>svg:first-child:last-child]:opacity-100',
        sizeClasses[size],
        bgColorClasses[color][intensity],
        txtIntensityClasses[intensity],
        className,
      )}
      style={{ lineHeight: 1 }}
      {...props}
    >
      {children}
    </span>
  );
};
