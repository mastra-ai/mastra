import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { useContext, useEffect, useRef } from 'react';
import { buttonVariants } from '../Button/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip/tooltip';
import { TabListContext } from './tabs-context';
import '@/ds/primitives/focus.css';
import { transitions } from '@/ds/primitives/transitions';
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
  // The tab renders a div, so disabled styling must also match Base UI aria/data attributes.
  const tabClassName =
    list?.variant === 'pill-ghost'
      ? cn(
          buttonVariants({ variant: 'ghost', size: 'md' }),
          'relative z-10 whitespace-nowrap',
          'data-[active]:text-neutral6',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
          className,
        )
      : cn(
          'text-ui-smd font-normal text-neutral3',
          attention && 'relative',
          'flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap outline-none',
          transitions.colors,
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
      className={cn(tabClassName, 'ds-focus ds-focus-contour')}
      onClick={onClick}
    >
      {children}
      <span aria-hidden="true" data-slot="focus-decoration" />
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
        <TooltipTrigger asChild>{tab}</TooltipTrigger>
        <TooltipContent>{disabledTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return tab;
};
