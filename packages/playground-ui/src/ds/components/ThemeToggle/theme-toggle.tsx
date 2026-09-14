import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme } from '../ThemeProvider';
import type { Theme } from '../ThemeProvider/theme-context';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface ThemeToggleOption {
  value: Theme;
  label: string;
  icon: React.ReactNode;
}

const DEFAULT_OPTIONS: ReadonlyArray<ThemeToggleOption> = [
  { value: 'system', label: 'System', icon: <Monitor /> },
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
];

const SIZE_CONFIG = {
  md: {
    itemGap: 2,
    itemWidth: 28,
    root: 'gap-0.5 p-0.5',
    indicator: 'inset-y-0.5 left-0.5',
    item: 'h-6 [&_svg]:size-3.5',
  },
  xs: {
    itemGap: 1,
    itemWidth: 20,
    root: 'gap-px p-px',
    indicator: 'inset-y-px left-px',
    item: 'h-4 [&_svg]:h-icon-sm [&_svg]:w-icon-sm',
  },
  sm: {
    itemGap: 1,
    itemWidth: 24,
    root: 'gap-px p-px',
    indicator: 'inset-y-px left-px',
    item: 'h-5 [&_svg]:h-icon-sm [&_svg]:w-icon-sm',
  },
} as const;

type RadioRootProps = Omit<
  RadioGroupPrimitive.Props,
  'value' | 'onChange' | 'onValueChange' | 'defaultValue' | 'className'
> & {
  className?: string;
};

type ControlledProps = { value: Theme; onChange: (next: Theme) => void };
type UncontrolledProps = { value?: undefined; onChange?: undefined };

export type ThemeToggleProps = RadioRootProps & {
  options?: ReadonlyArray<ThemeToggleOption>;
  size?: keyof typeof SIZE_CONFIG;
} & (ControlledProps | UncontrolledProps);

export const ThemeToggle = ({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  size = 'md',
  className,
  'aria-label': ariaLabel = 'Theme',
  ...rest
}: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme();
  const current = value ?? theme;
  const commit = onChange ?? setTheme;
  const effectiveCurrent = options.some(option => option.value === current) ? current : (options[0]?.value ?? 'system');

  const handleChange = (next: unknown) => {
    const match = options.find(opt => opt.value === next);
    if (match) commit(match.value);
  };

  const activeIndex = Math.max(
    0,
    options.findIndex(option => option.value === effectiveCurrent),
  );
  const sizeConfig = SIZE_CONFIG[size];
  const indicatorOffset = activeIndex * (sizeConfig.itemWidth + sizeConfig.itemGap);

  return (
    <RadioGroupPrimitive
      {...rest}
      value={effectiveCurrent}
      onValueChange={handleChange}
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex w-fit items-center rounded-full border border-border1 bg-surface3',
        sizeConfig.root,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute rounded-full bg-surface5 motion-reduce:transition-none',
          transitions.transform,
          sizeConfig.indicator,
        )}
        style={{ width: sizeConfig.itemWidth, transform: `translateX(${indicatorOffset}px)` }}
      />
      {options.map(option => (
        <RadioPrimitive.Root
          key={option.value}
          value={option.value}
          aria-label={option.label}
          style={{ width: sizeConfig.itemWidth }}
          className={cn(
            'relative inline-flex cursor-pointer items-center justify-center rounded-full',
            // Base UI exposes `data-checked` instead of Radix's `data-state="checked"`.
            'text-icon3 hover:text-icon6 data-[checked]:text-icon6',
            sizeConfig.item,
            'focus-visible:outline-hidden',
            'active:scale-90 motion-reduce:transition-none',
            transitions.colors,
            transitions.transform,
          )}
        >
          <span aria-hidden="true" className="pointer-events-none inline-flex items-center justify-center">
            {option.icon}
          </span>
        </RadioPrimitive.Root>
      ))}
    </RadioGroupPrimitive>
  );
};
