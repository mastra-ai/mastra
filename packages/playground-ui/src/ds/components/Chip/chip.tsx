import React from 'react';

import { cn } from '@/lib/utils';

const sizeClasses = {
  small: 'text-[10.5px]   pt-[5px] pb-[4px]',
  default: 'text-[11.5px] pt-[5px] pb-[4px] ',
  large: 'text-[12.5px]   pt-[5px] pb-[4px] ',
};

const bgColorClasses = {
  gray: {
    bright: 'bg-neutral-500/30',
    muted: 'bg-neutral-500/10',
  },
  red: { bright: 'bg-red-500/30', muted: 'bg-red-500/10' },
  orange: {
    bright: 'bg-orange-500/30',
    muted: 'bg-orange-500/10',
  },
  blue: { bright: 'bg-blue-500/30', muted: 'bg-blue-500/10' },
  green: { bright: 'bg-green-500/30', muted: 'bg-green-500/10' },
  purple: {
    bright: 'bg-purple-500/30',
    muted: 'bg-purple-500/10',
  },
  yellow: {
    bright: 'bg-yellow-500/30',
    muted: 'bg-yellow-500/10',
  },
  cyan: { bright: 'bg-cyan-500/30', muted: 'bg-cyan-500/10' },
  pink: { bright: 'bg-pink-500/30', muted: 'bg-pink-500/10' },
};

const txtIntensityClasses = {
  bright: 'text-neutral4/90',
  muted: 'text-neutral3/90',
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
        'inline-flex items-center rounded-lg uppercase px-1.5 gap-[0.4em] tracking-wide font-normal',
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
