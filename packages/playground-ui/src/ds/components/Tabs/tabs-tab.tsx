import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { X } from 'lucide-react';
import { useContext, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip/tooltip';
import { TabListContext } from './tabs-context';
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
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [register, value, children, disabled, onClick, onClose]);
  useEffect(() => () => unregister?.(value), [unregister, value]);
  const tab = (
    <BaseTabs.Tab
      render={<div />}
      nativeButton={false}
      value={value}
      disabled={disabled || overflowed}
      data-slot="tab"
      data-closable={onClose ? '' : undefined}
      className={cn(
        'text-ui-md font-normal text-neutral3',
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
      )}
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
  const tabWithTooltip =
    disabled && disabledTooltip ? (
      <Tooltip>
        <TooltipTrigger asChild>{tab}</TooltipTrigger>
        <TooltipContent>{disabledTooltip}</TooltipContent>
      </Tooltip>
    ) : (
      tab
    );

  return (
    <div
      ref={ref}
      data-slot="tab-item"
      data-overflowed={overflowed || undefined}
      aria-hidden={overflowed || undefined}
      className="relative flex shrink-0 items-center"
    >
      {tabWithTooltip}
      {onClose ? (
        <button
          type="button"
          data-slot="tab-close"
          onClick={onClose}
          className={cn('rounded p-0.5 hover:bg-surface4', transitions.colors, 'hover:text-neutral5')}
          aria-label="Close tab"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
};
