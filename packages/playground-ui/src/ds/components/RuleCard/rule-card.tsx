import type { ComponentProps, ReactNode } from 'react';

import { Input } from '@/ds/components/Input';
import type { InputProps } from '@/ds/components/Input';
import { IconArrowCornerDownRight } from '@/ds/icons/central/IconArrowCornerDownRight';
import { IconDotGrid2x3 } from '@/ds/icons/central/IconDotGrid2x3';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { textStyle } from '@/ds/primitives/text';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

// A rule reads top to bottom as a sentence: a header line (step, name, controls), its conditions in a box
// (`RuleCardBody`), then where it leads (`RuleCardOutcome`). Header and outcome sit outside the box, inset by
// the same `pl-4` as the box's content, so every line starts on one edge. The inset also holds the drag handle.

export type RuleCardProps = ComponentProps<'div'> & {
  /** A rule switched off: still editable, shown faded. */
  inactive?: boolean;
};

export function RuleCard({ inactive, className, ...props }: RuleCardProps) {
  return (
    <div
      data-slot="rule-card"
      data-inactive={inactive || undefined}
      className={cn('group/rule-card flex min-w-0 flex-col gap-1.5', inactive && 'opacity-70', className)}
      {...props}
    />
  );
}

export function RuleCardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="rule-card-header"
      className={cn('relative flex items-center gap-2 pr-2 pl-4', className)}
      {...props}
    />
  );
}

export type RuleCardDragHandleProps = Omit<ComponentProps<'button'>, 'children'> & {
  /** Names the rule it moves: "Reorder Bugs". */
  'aria-label': string;
};

/** Sits in the header's inset, before the step or name; shows on hover, on focus, and always on touch. */
export function RuleCardDragHandle({ className, ...props }: RuleCardDragHandleProps) {
  return (
    <button
      type="button"
      data-slot="rule-card-drag-handle"
      className={cn(
        'absolute top-1/2 left-0 flex h-control-sm w-4 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground hover:text-foreground active:cursor-grabbing',
        'opacity-0 group-hover/rule-card:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
        focusRing,
        className,
      )}
      {...props}
    >
      <IconDotGrid2x3 aria-hidden className="size-4" />
    </button>
  );
}

/** The rule's place in a chain ("If", "Else if", "Otherwise"), before its name. */
export function RuleCardStep({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="rule-card-step"
      className={cn(
        textStyle({ variant: 'caption', tone: 'ink' }),
        'inline-flex h-5 shrink-0 items-center rounded-sm border border-border bg-fill-subtle px-1.5',
        className,
      )}
      {...props}
    />
  );
}

/** The rule's name, read-only. */
export function RuleCardTitle({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="rule-card-title"
      className={cn(textStyle({ variant: 'label' }), 'min-w-0 flex-1 truncate', className)}
      {...props}
    />
  );
}

/** The rule's name, edited in place: it reads as the title until hovered or focused. */
export function RuleCardTitleInput({ className, ...props }: Omit<InputProps, 'variant' | 'size'>) {
  return (
    <Input
      variant="unstyled"
      size="sm"
      data-slot="rule-card-title-input"
      className={cn('min-w-0 flex-1 rounded-md hover:bg-fill-subtle focus:bg-fill-subtle', className)}
      {...props}
    />
  );
}

/** The box that holds the rule's conditions. */
export function RuleCardBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="rule-card-body"
      className={cn(raisedSurfaceStyle, 'flex flex-col gap-2 rounded-xl px-4 py-3', className)}
      {...props}
    />
  );
}

export type RuleCardOutcomeProps = ComponentProps<'div'> & {
  /** What happens, before the pickers that say where: "Send to", "Move to". */
  label: ReactNode;
};

/** "↪ Send to [Board] › [Phase]": where the rule leads, under its conditions. */
export function RuleCardOutcome({ label, className, children, ...props }: RuleCardOutcomeProps) {
  return (
    <div
      data-slot="rule-card-outcome"
      className={cn('flex flex-wrap items-center gap-1 pr-2 pl-4', className)}
      {...props}
    >
      <span
        className={cn(textStyle({ variant: 'caption', tone: 'muted' }), 'mr-2 flex h-control-sm items-center gap-1.5')}
      >
        <IconArrowCornerDownRight aria-hidden className="size-3.5 shrink-0" />
        {label}
      </span>
      {children}
    </div>
  );
}
