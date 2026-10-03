import * as flagSvgs from 'country-flag-icons/string/3x2';
import { ChevronsUpDown, PhoneIcon } from 'lucide-react';
import * as React from 'react';
import PhoneNumberInput, {
  getCountryCallingCode,
  isSupportedCountry,
  type Country,
  type FlagProps,
  type Props as BasePhoneInputProps,
} from 'react-phone-number-input';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Combobox } from '@/ds/components/Combobox';
import type { ComboboxOption } from '@/ds/components/Combobox';
import { Input } from '@/ds/components/Input';
import type { InputProps } from '@/ds/components/Input';
import type { ControlSize } from '@/ds/primitives/control-size';
import { cn } from '@/lib/utils';

type PhoneInputContextValue = {
  size: ControlSize;
  error?: boolean;
  testId?: string;
  countryAriaLabel: string;
};

const PhoneInputContext = React.createContext<PhoneInputContextValue>({
  size: 'md',
  countryAriaLabel: 'Country',
});

type CountryEntry = {
  label: string;
  value?: Country;
};

type CountrySelectProps = {
  disabled?: boolean;
  value?: Country;
  options: CountryEntry[];
  onChange: (country: Country) => void;
};

function Flag({ country }: FlagProps) {
  const svg = flagSvgs[country];

  return <img src={`data:image/svg+xml,${encodeURIComponent(svg)}`} alt="" className="h-3 w-4 shrink-0 rounded-xs" />;
}

const countryEnter =
  'motion-safe:animate-in motion-safe:duration-150 motion-safe:ease-out motion-safe:fade-in-0 motion-safe:zoom-in-95';

function CountryChevron() {
  return <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />;
}

function CountrySelect({ disabled, value, options, onChange }: CountrySelectProps) {
  const { size, countryAriaLabel } = React.useContext(PhoneInputContext);
  const countries: ComboboxOption[] = options.flatMap(option => {
    if (!option.value) return [];

    return [
      {
        value: option.value,
        label: option.label,
        displayLabel: (
          <span key={option.value} className={cn('flex items-center pl-2', countryEnter)}>
            <span className="sr-only">{option.label}</span>
            <CountryChevron />
          </span>
        ),
        start: <Flag key={option.value} country={option.value} countryName={option.label} />,
        end: <span className="text-muted-foreground">+{getCountryCallingCode(option.value)}</span>,
      },
    ];
  });

  return (
    <Combobox
      value={value}
      onValueChange={country => {
        if (isSupportedCountry(country)) onChange(country);
      }}
      options={countries}
      placeholder={
        <span className="flex items-center gap-2">
          <PhoneIcon aria-hidden className="size-4 text-muted-foreground" />
          <CountryChevron />
        </span>
      }
      searchPlaceholder="e.g. United States"
      emptyText="No country found."
      aria-label={countryAriaLabel}
      disabled={disabled}
      size={size}
      showChevron={false}
      iconOnlyValue
      className="w-auto shrink-0 motion-safe:[&_img]:animate-in motion-safe:[&_img]:duration-150 motion-safe:[&_img]:ease-out motion-safe:[&_img]:fade-in-0 motion-safe:[&_img]:zoom-in-95"
    />
  );
}

const PhoneNumberField = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { error, testId } = React.useContext(PhoneInputContext);
  return <Input {...props} ref={ref} type="tel" error={error} testId={testId} />;
});
PhoneNumberField.displayName = 'PhoneNumberField';

const PhoneInputContainer = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => {
    const { size } = React.useContext(PhoneInputContext);
    return <ButtonsGroup {...props} ref={ref} size={size} className={cn('w-full', className)} />;
  },
);
PhoneInputContainer.displayName = 'PhoneInputContainer';

type PhoneNumberProps = BasePhoneInputProps<React.InputHTMLAttributes<HTMLInputElement>>;

export type PhoneInputProps = Omit<
  PhoneNumberProps,
  | 'className'
  | 'containerComponent'
  | 'countrySelectComponent'
  | 'flagComponent'
  | 'inputComponent'
  | 'numberInputProps'
  | 'onChange'
  | 'size'
  | 'value'
> & {
  value?: string;
  defaultValue?: string;
  size?: ControlSize;
  error?: boolean;
  testId?: string;
  countryAriaLabel?: string;
  className?: string;
  onValueChange?: (value: string) => void;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      defaultValue = '',
      size = 'md',
      error,
      testId,
      countryAriaLabel = 'Country',
      className,
      name,
      placeholder = 'Enter phone number',
      autoComplete = 'tel',
      defaultCountry,
      limitMaxLength = true,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const resolvedValue = value ?? uncontrolledValue;
    const resolvedSize = size ?? 'md';
    const commitValue = (nextValue: string) => {
      if (value === undefined) setUncontrolledValue(nextValue);
      onValueChange?.(nextValue);
    };

    return (
      <PhoneInputContext.Provider value={{ size: resolvedSize, error, testId, countryAriaLabel }}>
        <PhoneNumberInput
          {...props}
          ref={ref}
          value={resolvedValue || undefined}
          defaultCountry={defaultCountry}
          onChange={(nextValue: string | undefined) => {
            const normalizedValue = nextValue ?? '';
            commitValue(limitMaxLength ? normalizedValue.slice(0, 16) : normalizedValue);
          }}
          className={className}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error || undefined}
          limitMaxLength={limitMaxLength}
          international
          withCountryCallingCode
          countrySelectComponent={CountrySelect}
          inputComponent={PhoneNumberField}
          containerComponent={PhoneInputContainer}
        />
        {name ? <input type="hidden" name={name} value={resolvedValue} /> : null}
      </PhoneInputContext.Provider>
    );
  },
);
PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
export type { Country as CountryCode };
