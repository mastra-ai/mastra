import { Monitor, Moon, Sun } from 'lucide-react';

import { SegmentedControl } from '../SegmentedControl';
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

export type ThemeToggleProps = {
  options?: ReadonlyArray<ThemeToggleOption>;
  /**
   * Control rung, shared with Button and Select. `xs` is deprecated: the control can no longer
   * be shorter than the smallest rung, so it renders as `sm`.
   */
  size?: ControlSize | 'xs';
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
} & (ControlledProps | UncontrolledProps);

/** Icon-only `SegmentedControl` bound to the active theme, or to `value`/`onChange` when controlled. */
export const ThemeToggle = ({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  size = 'md',
  className,
  disabled,
  'aria-label': ariaLabel = 'Theme',
}: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme();
  const current = value ?? theme;
  const commit = onChange ?? setTheme;
  const effectiveCurrent = options.some(option => option.value === current) ? current : (options[0]?.value ?? 'system');

  return (
    <SegmentedControl
      aria-label={ariaLabel}
      iconOnly
      size={size === 'xs' ? 'sm' : size}
      options={options}
      value={effectiveCurrent}
      onValueChange={commit}
      disabled={disabled}
      className={className}
    />
  );
};
