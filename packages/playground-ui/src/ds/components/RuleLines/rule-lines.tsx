import type { ComponentProps, ReactNode } from 'react';

import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/ds/components/Select';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { IconTrashCan } from '@/ds/icons/central/IconTrashCan';
import { textStyle } from '@/ds/primitives/text';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

// Conditions read as a sentence, one line each: a keyword column ("Where", "and", "or") then the line's pickers.
// The keyword column has one width, so every picker starts on the same edge, and so do the add buttons under them.

const keywordColumn = 'flex h-control-sm w-14 shrink-0 items-center';

/** The lines, top to bottom. Give the outer list `role="group"` and a name. */
export function RuleLines({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="rule-lines" className={cn('flex flex-col gap-2', className)} {...props} />;
}

/** One line: a `RuleLineKeyword` or `RuleLineLogic`, then a `RuleLineContent` or a `RuleLineGroup`. */
export function RuleLine({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="rule-line" className={cn('flex items-start gap-2', className)} {...props} />;
}

/** The word that joins a line to the ones above. Left empty, it keeps the column so the line lines up. */
export function RuleLineKeyword({ className, children, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="rule-line-keyword"
      aria-hidden={children === undefined || undefined}
      className={cn(keywordColumn, textStyle({ variant: 'caption', tone: 'muted' }), className)}
      {...props}
    >
      {children}
    </span>
  );
}

export type RuleLogic = 'AND' | 'OR';

export type RuleLineLogicProps = {
  value: RuleLogic;
  onValueChange: (value: RuleLogic) => void;
  /** Defaults to "Match all or any". */
  'aria-label'?: string;
};

/** The keyword that also picks how a group's lines combine: "and" or "or". */
export function RuleLineLogic({ value, onValueChange, 'aria-label': label = 'Match all or any' }: RuleLineLogicProps) {
  return (
    <div data-slot="rule-line-logic" className={keywordColumn}>
      <Select value={value} onValueChange={next => next && onValueChange(next)}>
        <SelectTrigger size="sm" variant="ghost" aria-label={label} className="-ml-2 w-fit px-2">
          <span className={textStyle({ variant: 'caption', tone: 'ink' })}>{value === 'AND' ? 'and' : 'or'}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AND">and</SelectItem>
          <SelectItem value="OR">or</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** A line's pickers, wrapping onto more rows when narrow. */
export function RuleLineContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="rule-line-content"
      className={cn('flex min-h-control-sm min-w-0 flex-1 flex-wrap items-center gap-1.5', className)}
      {...props}
    />
  );
}

export type RuleLineGroupProps = ComponentProps<'div'> & {
  /** Nesting level, from 0: each level alternates the fill so it stands apart from the one around it. */
  depth: number;
};

/** A nested set of lines in its own box: put a `RuleLines` in it, with a `RuleLineGroupRemove` on its last line. Name it. */
export function RuleLineGroup({ depth, className, ...props }: RuleLineGroupProps) {
  return (
    <div
      role="group"
      data-slot="rule-line-group"
      className={cn(
        'flex min-w-0 flex-1 items-start gap-2 rounded-lg border border-border p-2',
        depth % 2 === 0 ? 'bg-fill-subtle' : 'bg-card',
        '[&>[data-slot=rule-lines]]:min-w-0 [&>[data-slot=rule-lines]]:flex-1',
        className,
      )}
      {...props}
    />
  );
}

export type RuleLineRemoveProps = Omit<ButtonProps, 'children' | 'variant' | 'size'> & {
  /** What it removes, such as "Remove condition". */
  'aria-label': string;
};

/** Removes one line; ends it. A whole group uses `RuleLineGroupRemove`. */
export function RuleLineRemove({ className, ...props }: RuleLineRemoveProps) {
  return (
    <Button variant="ghost" size="icon-sm" className={cn('ml-auto', className)} {...props}>
      <IconCrossMedium />
    </Button>
  );
}

/** Removes a whole group. Spelled out and set apart from the lines' X buttons, so it can't be taken for one of them. */
export function RuleLineGroupRemove({
  className,
  children,
  ...props
}: Omit<ButtonProps, 'variant' | 'size'> & { children: ReactNode }) {
  return (
    <Button variant="ghost" size="sm" className={cn('ml-auto', className)} {...props}>
      <IconTrashCan />
      {children}
    </Button>
  );
}

/** A quiet note on a line, such as what an empty rule matches. */
export function RuleLineHint({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="rule-line-hint"
      className={cn(textStyle({ variant: 'caption', tone: 'muted' }), 'px-1', className)}
      {...props}
    />
  );
}

export type RuleAddButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  icon?: ReactNode;
  children: ReactNode;
};

/** Adds a line, a group or a whole rule: dashed, the outline of something not written yet. */
export function RuleAddButton({ icon, className, children, ...props }: RuleAddButtonProps) {
  return (
    <button
      type="button"
      data-slot="rule-add-button"
      className={cn(
        textStyle({ variant: 'caption', tone: 'muted' }),
        'inline-flex h-control-sm items-center gap-1.5 rounded-full border border-dashed border-border px-3 hover:border-border-strong hover:text-foreground [&_svg]:size-3.5',
        focusRing,
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
