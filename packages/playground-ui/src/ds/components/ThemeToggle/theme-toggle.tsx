import { Monitor, Moon, Sun } from 'lucide-react';

import { SegmentedControl, SegmentedControlItem } from '../SegmentedControl';
import type { SegmentedControlProps } from '../SegmentedControl';
import { useTheme } from '../ThemeProvider';
import type { Theme } from '../ThemeProvider/theme-context';
import type { ControlSize } from '@/ds/primitives/control-size';

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

type ControlledProps = { value: Theme; onChange: (next: Theme) => void };
type UncontrolledProps = { value?: undefined; onChange?: undefined };

type ThemeToggleGroupProps = Omit<
  SegmentedControlProps<Theme>,
  'value' | 'onValueChange' | 'onChange' | 'aria-label' | 'size' | 'iconOnly' | 'children'
>;

export type ThemeToggleProps = ThemeToggleGroupProps & {
  options?: ReadonlyArray<ThemeToggleOption>;
  /**
   * Control rung, shared with Button and Select. `xs` is deprecated: the control can no longer
   * be shorter than the smallest rung, so it renders as `sm`.
   */
  size?: ControlSize | 'xs';
  'aria-label'?: string;
} & (ControlledProps | UncontrolledProps);

/** The theme to show as selected: the current one if it is an option, else the first option. */
function pickSelectedTheme(options: ReadonlyArray<ThemeToggleOption>, current: Theme): Theme {
  if (options.some(option => option.value === current)) return current;
  const [first] = options;
  if (first) return first.value;
  return 'system';
}

/** Icon-only `SegmentedControl` bound to the active theme, or to `value`/`onChange` when controlled. */
export const ThemeToggle = ({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  size = 'md',
  'aria-label': ariaLabel = 'Theme',
  ...groupProps
}: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme();
  const current = value ?? theme;
  const commit = onChange ?? setTheme;
  const selected = pickSelectedTheme(options, current);

  return (
    <SegmentedControl
      {...groupProps}
      aria-label={ariaLabel}
      iconOnly
      size={size === 'xs' ? 'sm' : size}
      value={selected}
      onValueChange={commit}
    >
      {options.map(option => (
        <SegmentedControlItem key={option.value} value={option.value} aria-label={option.label}>
          {option.icon}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
};
