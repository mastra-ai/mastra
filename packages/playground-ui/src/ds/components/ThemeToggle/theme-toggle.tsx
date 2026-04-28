import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
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

const ITEM_WIDTH = 28;
const ITEM_GAP = 2;

type RadioRootProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
  'value' | 'onChange' | 'onValueChange' | 'orientation' | 'defaultValue'
>;

type ControlledProps = { value: Theme; onChange: (next: Theme) => void };
type UncontrolledProps = { value?: undefined; onChange?: undefined };

export type ThemeToggleProps = RadioRootProps & {
  options?: ReadonlyArray<ThemeToggleOption>;
} & (ControlledProps | UncontrolledProps);

export const ThemeToggle = ({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  className,
  'aria-label': ariaLabel = 'Theme',
  ...rest
}: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme();
  const current = value ?? theme;
  const commit = onChange ?? setTheme;
  const effectiveCurrent = options.some(option => option.value === current) ? current : (options[0]?.value ?? 'system');

  const handleChange = (next: string) => {
    const match = options.find(opt => opt.value === next);
    if (match) commit(match.value);
  };

  const activeIndex = Math.max(
    0,
    options.findIndex(option => option.value === effectiveCurrent),
  );
  const indicatorOffset = activeIndex * (ITEM_WIDTH + ITEM_GAP);

  return (
    <RadioGroupPrimitive.Root
      {...rest}
      value={effectiveCurrent}
      onValueChange={handleChange}
      orientation="horizontal"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex w-fit items-center gap-0.5 rounded-full border border-border1 bg-surface3 p-0.5',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0.5 left-0.5 rounded-full bg-surface5 motion-reduce:transition-none',
          transitions.transform,
        )}
        style={{ width: ITEM_WIDTH, transform: `translateX(${indicatorOffset}px)` }}
      />
      {options.map(option => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          aria-label={option.label}
          style={{ width: ITEM_WIDTH }}
          className={cn(
            'relative inline-flex h-6 cursor-pointer items-center justify-center rounded-full',
            '[&_svg]:size-3.5 text-icon3 hover:text-icon6 data-[state=checked]:text-icon6',
            'focus-visible:outline-hidden',
            'active:scale-90 motion-reduce:transition-none',
            transitions.colors,
            transitions.transform,
          )}
        >
          <span aria-hidden="true" className="pointer-events-none inline-flex items-center justify-center">
            {option.icon}
          </span>
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
};
