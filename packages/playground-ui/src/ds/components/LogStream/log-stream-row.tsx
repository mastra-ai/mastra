import type { ComponentProps } from 'react';
import { logLevelBarClass } from './log-level-styles';
import type { LogLevel } from './log-level-styles';
import { focusRingInset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

interface LogStreamRowTone {
  level?: LogLevel;
  featured?: boolean;
}

function rowClass({ level, featured }: LogStreamRowTone, interactive: boolean, className?: string) {
  return cn(
    'relative col-span-full grid min-h-6 grid-cols-subgrid items-start gap-x-4 gap-y-1 px-3 py-0.5 text-left',
    "before:absolute before:inset-y-1 before:left-1 before:w-0.5 before:rounded-full before:content-['']",
    level ? logLevelBarClass[level] : 'before:bg-border-strong',
    (level === 'error' || level === 'fatal') && 'bg-destructive-subtle',
    featured && 'bg-surface-panel',
    interactive && [
      "cursor-pointer after:pointer-events-none after:absolute after:inset-0 after:content-[''] hover:after:bg-fill-subtle focus-visible:bg-surface-panel",
      focusRingInset,
    ],
    className,
  );
}

export type LogStreamRowProps = ComponentProps<'div'> & LogStreamRowTone;

export function LogStreamRow({ level, featured, className, ...props }: LogStreamRowProps) {
  return (
    <div className={rowClass({ level, featured }, false, className)} data-featured={featured || undefined} {...props} />
  );
}

export type LogStreamRowButtonProps = ComponentProps<'button'> & LogStreamRowTone;

export function LogStreamRowButton({ level, featured, className, type = 'button', ...props }: LogStreamRowButtonProps) {
  return (
    <button
      type={type}
      className={rowClass({ level, featured }, true, className)}
      data-featured={featured || undefined}
      {...props}
    />
  );
}
