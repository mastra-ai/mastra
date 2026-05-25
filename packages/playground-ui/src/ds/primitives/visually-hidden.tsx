import { cloneElement, isValidElement } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type VisuallyHiddenChildProps = {
  className?: string;
};

export type VisuallyHiddenProps = HTMLAttributes<HTMLSpanElement> & {
  asChild?: boolean;
  children?: ReactNode;
};

export function VisuallyHidden({ asChild, children, className, ...props }: VisuallyHiddenProps) {
  const hiddenClassName = cn(className, 'sr-only');

  if (asChild && isValidElement<VisuallyHiddenChildProps>(children)) {
    const child = children as ReactElement<VisuallyHiddenChildProps>;

    return cloneElement(child, {
      ...(props as Record<string, unknown>),
      className: cn(child.props.className, hiddenClassName),
    } as Partial<VisuallyHiddenChildProps>);
  }

  return (
    <span {...props} className={hiddenClassName}>
      {children}
    </span>
  );
}
