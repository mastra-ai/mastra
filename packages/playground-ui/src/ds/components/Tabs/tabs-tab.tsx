import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { useContext, useEffect, useRef } from 'react';
import { buttonVariants } from '../Button/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip/tooltip';
import { TabListContext } from './tabs-context';
import { controlHeight } from '@/ds/primitives/control-size';
import { controlStateColorTransition, focusRing } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/lib/utils';

export type TabProps = {
  children: React.ReactNode;
  value: string;
  onClick?: () => void;
  onClose?: () => void;
  disabled?: boolean;
  attention?: boolean;
  disabledTooltip?: React.ReactNode;
  /** Tooltip shown on hover and keyboard focus of an enabled tab (e.g. when its label is collapsed to an icon). */
  tooltip?: React.ReactNode;
  className?: string;
};

export const Tab = ({
  children,
  value,
  onClick,
  onClose,
  disabled,
  disabledTooltip,
  tooltip,
  attention = false,
  className,
}: TabProps) => {
  const list = useContext(TabListContext);
  const ref = useRef<HTMLDivElement>(null);
  const register = list?.register;
  const unregister = list?.unregister;
  const overflowed = list?.hiddenValues.has(value) ?? false;
  useEffect(() => {
    const element = ref.current;
    if (!element || !register) return;
    const measure = () =>
      register({
        value,
        label: children,
        disabled: disabled ?? false,
        width: element.getBoundingClientRect().width,
        element,
        onClick,
        onClose,
      });
    measure();
    if (!('ResizeObserver' in globalThis)) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [register, value, children, disabled, onClick, onClose]);
  useEffect(() => () => unregister?.(value), [unregister, value]);
  // The tab renders as a <div>, so the recipe's `disabled:` pseudo never matches; mirror it on the
  // aria/data attributes Base UI sets.
  const size = list?.size ?? 'md';
  const tabClassName =
    list?.variant === 'pill-ghost'
      ? cn(
          // A ghost tab is the control itself: the button box at the list's rung.
          buttonVariants({ variant: 'ghost', size }),
          'relative z-10 whitespace-nowrap',
          'data-[active]:text-foreground',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          className,
        )
      : cn(
          'text-label',
          quietTextHover,
          attention && 'relative',
          'flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap outline-none',
          controlStateColorTransition,
          focusRing,
          'data-[active]:text-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-foreground',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:text-muted-foreground',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:hover:text-muted-foreground',
          className,
        );
  // An outlined pill, filled when open. No colour transition: picking a chip swaps at once.
  const chipClassName =
    list?.variant === 'chips'
      ? cn(
          'relative flex cursor-pointer items-center justify-center rounded-full border whitespace-nowrap outline-none',
          size === 'sm' ? 'h-6 px-2.5 text-column' : cn(controlHeight.md, 'px-3 text-label'),
          'border-border text-muted-foreground hover:bg-fill-subtle hover:text-foreground',
          // The selected chip, from `aria-selected`: Base UI's `data-active` follows keyboard highlight too.
          'aria-selected:border-border-strong aria-selected:bg-fill-hover aria-selected:text-foreground',
          focusRing,
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          className,
        )
      : undefined;
  const tab = (
    <BaseTabs.Tab
      ref={ref}
      render={<div />}
      nativeButton={false}
      data-overflowed={overflowed || undefined}
      aria-hidden={overflowed || undefined}
      value={value}
      disabled={disabled || overflowed}
      data-slot="tab"
      // Base UI's drawer and toast swipe skips buttons but not a `div` tab: without this, pressing a
      // tab inside a drawer starts a swipe and the click never reaches the tab.
      data-base-ui-swipe-ignore=""
      data-closable={onClose ? '' : undefined}
      className={chipClassName ?? tabClassName}
      onClick={onClick}
    >
      {children}
      {attention && (
        <>
          <span aria-hidden="true" data-slot="tab-attention" />
          <span className="sr-only"> Needs attention</span>
        </>
      )}
    </BaseTabs.Tab>
  );
  if (disabled && disabledTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span tabIndex={0} className="inline-flex" />}>{tab}</TooltipTrigger>
        <TooltipContent>{disabledTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  if (tooltip && !disabled) {
    return (
      <Tooltip>
        <TooltipTrigger render={tab} />
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return tab;
};
