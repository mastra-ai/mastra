import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import * as React from 'react';

import { formElementFocus } from '@/ds/primitives/form-element';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type CheckboxVariant = 'primary' | 'neutral';

const variantCheckedClasses: Record<CheckboxVariant, string> = {
  primary:
    'data-[state=checked]:bg-accent1 data-[state=checked]:border-accent1 data-[state=checked]:text-surface1 data-[state=checked]:shadow-glow-accent1',
  neutral:
    'data-[state=checked]:bg-neutral3 data-[state=checked]:border-neutral3 data-[state=checked]:text-surface1',
};

interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  variant?: CheckboxVariant;
}

const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'peer h-4 w-4 shrink-0 rounded-sm border border-neutral3',
        'shadow-sm',
        transitions.all,
        'hover:border-neutral5 hover:shadow-md',
        formElementFocus,
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral3 disabled:hover:shadow-sm',
        variantCheckedClasses[variant],
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn(
          'flex items-center justify-center text-current',
          'data-[state=checked]:animate-in data-[state=checked]:zoom-in-50 data-[state=checked]:duration-150',
        )}
      >
        <Check className="h-3.5 w-3.5 stroke-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
