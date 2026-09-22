import * as flagSvgs from 'country-flag-icons/string/3x2';
import { PhoneIcon } from 'lucide-react';
import * as React from 'react';
import PhoneNumberInput, {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumber,
  type Country,
  type FlagProps,
  type Props as BasePhoneInputProps,
} from 'react-phone-number-input';
import { Combobox } from '@/ds/components/Combobox';
import type { ComboboxOption } from '@/ds/components/Combobox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ds/components/InputGroup';
import type { InputGroupInputProps } from '@/ds/components/InputGroup';
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

  return (
    <img
      src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
      alt=""
      className="h-3 w-4 shrink-0 rounded-xs motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-safe:zoom-in-95"
    />
  );
}

function CountrySelect({ disabled, value, options, onChange }: CountrySelectProps) {
  const { size, countryAriaLabel } = React.useContext(PhoneInputContext);
  const countries: ComboboxOption[] = options.flatMap(option => {
    if (!option.value) return [];

    return [
      {
        value: option.value,
        label: option.label,
        displayLabel: <span className="sr-only">{option.label}</span>,
        start: <Flag key={option.value} country={option.value} countryName={option.label} />,
        end: <span className="text-muted-foreground">+{getCountryCallingCode(option.value)}</span>,
      },
    ];
  });

  return (
    <InputGroupAddon>
      <Combobox
        value={value}
        onValueChange={country => {
          if (isSupportedCountry(country)) onChange(country);
        }}
        options={countries}
        placeholder={
          <span className="flex items-center justify-center">
            <PhoneIcon aria-hidden className="size-4 text-muted-foreground" />
          </span>
        }
        searchPlaceholder="e.g. United States"
        emptyText="No country found."
        aria-label={countryAriaLabel}
        disabled={disabled}
        size={size}
        showChevron={false}
        iconOnlyValue
        variant="ghost"
        className="w-8 shrink-0 rounded-full px-0"
      />
    </InputGroupAddon>
  );
}

const PhoneNumberField = React.forwardRef<HTMLInputElement, InputGroupInputProps>((props, ref) => {
  const { error, testId } = React.useContext(PhoneInputContext);
  return <InputGroupInput {...props} ref={ref} type="tel" error={error} testId={testId} />;
});
PhoneNumberField.displayName = 'PhoneNumberField';

const PhoneInputContainer = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => {
    const { size } = React.useContext(PhoneInputContext);
    return <InputGroup {...props} ref={ref} size={size} className={cn('w-full', className)} />;
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
      onPaste,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const [pastedCountry, setPastedCountry] = React.useState<Country>();
    const [pasteVersion, setPasteVersion] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const restoreFocus = React.useRef(false);
    const resolvedValue = value ?? uncontrolledValue;
    const resolvedSize = size ?? 'md';
    const commitValue = (nextValue: string) => {
      if (value === undefined) setUncontrolledValue(nextValue);
      onValueChange?.(nextValue);
    };

    React.useImperativeHandle(ref, () => {
      const input = inputRef.current;
      if (!input) throw new Error('Phone input ref is unavailable');
      return input;
    }, []);

    React.useLayoutEffect(() => {
      if (!restoreFocus.current) return;
      restoreFocus.current = false;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    }, [pasteVersion]);

    return (
      <PhoneInputContext.Provider value={{ size: resolvedSize, error, testId, countryAriaLabel }}>
        <PhoneNumberInput
          {...props}
          key={pasteVersion}
          value={resolvedValue || undefined}
          defaultCountry={pastedCountry ?? defaultCountry}
          onChange={(nextValue: string | undefined) => {
            const normalizedValue = nextValue ?? '';
            commitValue(limitMaxLength ? normalizedValue.slice(0, 16) : normalizedValue);
          }}
          onPaste={(event: React.ClipboardEvent<HTMLInputElement>) => {
            onPaste?.(event);
            if (event.defaultPrevented) return;
            const pastedValue = event.clipboardData.getData('text').trim();
            if (!pastedValue.startsWith('+')) return;
            const phoneNumber = parsePhoneNumber(pastedValue);
            if (!phoneNumber?.country || !phoneNumber.isPossible()) return;
            event.preventDefault();
            restoreFocus.current = true;
            setPastedCountry(phoneNumber.country);
            setPasteVersion(version => version + 1);
            commitValue(phoneNumber.number);
          }}
          className={className}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error || undefined}
          initialValueFormat="national"
          limitMaxLength={limitMaxLength}
          smartCaret={false}
          countrySelectComponent={CountrySelect}
          inputComponent={PhoneNumberField}
          containerComponent={PhoneInputContainer}
          numberInputProps={{ ref: inputRef }}
        />
        {name ? <input type="hidden" name={name} value={resolvedValue} /> : null}
      </PhoneInputContext.Provider>
    );
  },
);
PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
export type { Country as CountryCode };
