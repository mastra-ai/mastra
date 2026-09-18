import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { useContext, useEffect, useRef } from 'react';
import { buttonVariants } from '../Button/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip/tooltip';
import { TabListContext } from './tabs-context';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type TabProps = {
  children: React.ReactNode;
  value: string;
  onClick?: () => void;
  onClose?: () => void;
  disabled?: boolean;
  attention?: boolean;
  disabledTooltip?: React.ReactNode;
  className?: string;
};

export const Tab = ({
  children,
  value,
  onClick,
  onClose,
  disabled,
  disabledTooltip,
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
          buttonVariants({ variant: 'ghost', size }),
          'relative z-10 whitespace-nowrap',
          'data-[active]:text-neutral6',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          className,
        )
      : cn(
          // `sm` mirrors the `sm` button box so tabs sit level with sibling `size="sm"` controls.
          size === 'sm' ? controlSizeClasses.sm : 'text-ui-smd',
          'font-normal text-neutral3',
          attention && 'relative',
          'flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap outline-none',
          transitions.colors,
          focusRing.visible,
          'hover:text-neutral4',
          'data-[active]:text-neutral5',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-neutral3',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:text-neutral3',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:hover:text-neutral3',
          className,
        );
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
      data-closable={onClose ? '' : undefined}
      className={tabClassName}
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

  return tab;
};
