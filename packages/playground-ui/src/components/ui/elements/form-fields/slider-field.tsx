import { cn } from '@/lib/utils';
import { TriangleAlertIcon } from 'lucide-react';
import * as React from 'react';
import * as RadixSlider from '@radix-ui/react-slider';

type SliderFieldProps = React.ComponentProps<typeof RadixSlider.Root> & {
  name?: string;
  testId?: string;
  label?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  value?: number[];
  helpMsg?: string;
  errorMsg?: string;
  className?: string;
};

export function SliderField({
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
  ...props
}: SliderFieldProps) {
  return (
    <div
      className={cn(
        'grid gap-[.5rem] grid-rows-[auto_1fr]',
        {
          'grid-rows-[auto_1fr_auto]': helpMsg,
        },
        className,
      )}
    >
      <label className={cn('text-[0.8125rem] text-icon3 flex justify-between items-center')}>
        {label}
        {required && <i className="text-icon2">(required)</i>}
      </label>
      <div className={cn('grid w-full items-center gap-[1rem] grid-cols-[1fr_auto]')}>
        <RadixSlider.Root
          name={name}
          className={cn('relative flex w-full touch-none select-none items-center ', className)}
          value={value}
          disabled={disabled}
          {...props}
        >
          <RadixSlider.Track className="relative h-[4px] w-full grow overflow-hidden rounded-full bg-gray-600">
            <RadixSlider.Range className="absolute h-full bg-gray-400" />
          </RadixSlider.Track>
          <RadixSlider.Thumb className="block h-4 w-4 rounded-full bg-gray-400 shadow transition-colors disabled:pointer-events-none disabled:opacity-50" />
        </RadixSlider.Root>
        <span className="text-icon4 text-[0.875rem] flex justify-end">{value}</span>
      </div>
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
  );
}
