import { cn } from '@/lib/utils';
import { Circle, TriangleAlertIcon } from 'lucide-react';
import * as React from 'react';
import * as RadixRadioGroup from '@radix-ui/react-radio-group';

type RadioGroupFieldProps = React.ComponentProps<typeof RadixRadioGroup.Root> & {
  name?: string;
  testId?: string;
  label?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  value?: number[];
  helpMsg?: string;
  errorMsg?: string;
  className?: string;
  options?: { value: string; label: string }[];
  layout?: 'horizontal' | 'vertical';
  onChange?: (value: string) => void;
};

export function RadioGroupField({
  name,
  value,
  label,
  className,
  testId,
  required,
  disabled,
  helpMsg,
  errorMsg,
  onChange,
  options = [],
  layout = 'vertical',
  onValueChange,
  ...props
}: RadioGroupFieldProps) {
  // the <fieldset> element is not stylable so to get the layout we want
  // we use a div + role and + aria-labelledby hack here
  const Wrapper = layout === 'horizontal' ? 'div' : 'fieldset';

  return (
    <Wrapper
      className={cn(
        'w-full',
        {
          'flex items-center gap-[2rem]': layout === 'horizontal',
        },
        className,
      )}
      role={layout === 'horizontal' ? 'radiogroup' : undefined}
      aria-labelledby={layout === 'horizontal' ? undefined : `${name}-legend`}
    >
      <legend id={`${name}-legend`} className={cn('text-[0.8125rem] text-icon3')}>
        {label}
      </legend>
      <div
        className={cn('grid gap-[2.5rem]', {
          'mt-[0.5rem]': layout === 'vertical',
          'grid-rows-[1fr_auto]': helpMsg,
        })}
      >
        <RadixRadioGroup.Root
          value={value}
          onValueChange={onValueChange}
          {...props}
          className={cn({
            'grid gap-[0.5rem]': layout === 'vertical',
            'flex gap-[1rem]': layout === 'horizontal',
          })}
        >
          {options.map(option => {
            return (
              <label className="flex items-center gap-[0.5rem] text-[0.875rem] text-icon4 " key={option.value}>
                <RadixRadioGroup.Item
                  className="aspect-square h-4 w-4 rounded-full border border-primary text-primary disabled:cursor-not-allowed disabled:opacity-50 "
                  value={option.value}
                >
                  <RadixRadioGroup.Indicator className="flex items-center justify-center">
                    <Circle className="h-2.5 w-2.5 fill-current text-current" />
                  </RadixRadioGroup.Indicator>
                </RadixRadioGroup.Item>
                {option.label}
              </label>
            );
          })}
        </RadixRadioGroup.Root>

        {helpMsg && <p className="text-icon3 text-[0.75rem]">{helpMsg}</p>}
        {errorMsg && (
          <p
            className={cn(
              'text-[0.75rem] text-red-500 flex items-center gap-[.5rem]',
              '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:opacity-70',
            )}
          >
            <TriangleAlertIcon /> {errorMsg}
          </p>
        )}
      </div>
    </Wrapper>
  );
}
