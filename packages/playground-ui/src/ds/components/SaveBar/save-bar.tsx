import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { IconCircleCheck } from '@/ds/icons/central/IconCircleCheck';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';
import { cn } from '@/lib/utils';

export type SaveBarTone = 'neutral' | 'success' | 'error';

export interface SaveBarProps {
  status: ReactNode;
  tone?: SaveBarTone;
  children?: ReactNode;
  className?: string;
}

const SHAKE: Keyframe[] = [
  { translate: '0 0' },
  { translate: '-4px 0' },
  { translate: '4px 0' },
  { translate: '-2px 0' },
  { translate: '0 0' },
];

const ICON: Record<SaveBarTone, typeof IconCircleCheck | undefined> = {
  neutral: undefined,
  success: IconCircleCheck,
  error: IconExclamationTriangle,
};

const EDGE: Record<SaveBarTone, string> = {
  neutral: 'outline-transparent',
  success: 'outline-success-edge',
  error: 'outline-destructive-edge',
};

const TEXT: Record<SaveBarTone, string> = {
  neutral: 'text-muted-foreground',
  success: 'text-success-indicator',
  error: 'text-destructive-foreground',
};

function useShakeOnError(tone: SaveBarTone) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tone !== 'error') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ref.current?.animate(SHAKE, { duration: 320, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' });
  }, [tone]);
  return ref;
}

export function SaveBar({ status, tone = 'neutral', children, className }: SaveBarProps) {
  const ref = useShakeOnError(tone);
  const Icon = ICON[tone];

  return (
    <div
      ref={ref}
      data-slot="save-bar"
      data-tone={tone}
      className={cn(
        'flex items-center gap-3 rounded-card bg-card p-3 shadow-overlay outline-1 -outline-offset-1 transition-[outline-color] duration-normal ease-out-custom outline-solid motion-reduce:transition-none dark:bg-muted',
        EDGE[tone],
        className,
      )}
    >
      <div
        role={tone === 'error' ? 'alert' : 'status'}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 transition-colors duration-normal ease-out-custom motion-reduce:transition-none',
          TEXT[tone],
        )}
      >
        {Icon ? (
          <span
            key={tone}
            aria-hidden
            className="flex size-icon-sm shrink-0 motion-safe:animate-[save-bar-icon-in_200ms_var(--ease-out-custom)_both]"
          >
            <Icon className="size-full" />
          </span>
        ) : null}
        <Txt as="span" variant="body-sm" className="min-w-0 truncate">
          {status}
        </Txt>
      </div>
      {children}
    </div>
  );
}
