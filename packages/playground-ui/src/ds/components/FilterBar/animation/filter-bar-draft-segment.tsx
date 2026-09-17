import type { CSSProperties, ReactNode, Ref } from 'react';
import { segmentClass } from '../filter-bar-chip';
import styles from './filter-bar-animation.module.css';
import { cn } from '@/lib/utils';

export function FilterBarDraftSegment({
  children,
  className,
  style,
  joined = false,
  ref,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  joined?: boolean;
  ref?: Ref<HTMLSpanElement>;
}) {
  return (
    <span
      ref={ref}
      data-slot="filter-bar-draft-segment"
      data-joined={joined || undefined}
      className={cn(
        segmentClass,
        styles.segment,
        'h-form-md border border-border1 bg-surface5 py-1 text-neutral5 hover:bg-surface6 hover:text-neutral6',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
