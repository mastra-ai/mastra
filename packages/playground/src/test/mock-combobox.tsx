/**
 * Lightweight stand-in for `@mastra/playground-ui/components/Combobox` so tests
 * can drive selection with `fireEvent.change` instead of the cmdk popover.
 *
 * Usage: `vi.mock('@mastra/playground-ui/components/Combobox', () => import('@/test/mock-combobox'));`
 *
 * - Single select renders a `<select>` (role `combobox`) labelled by `placeholder`.
 * - Multi select renders a `<select multiple>` (role `listbox`) labelled by `placeholder`.
 */
export const Combobox = ({
  options,
  value,
  onValueChange,
  placeholder,
  multiple,
}: {
  options: Array<{ label: string; value: string }>;
  value?: string | string[];
  onValueChange?: (value: any) => void;
  placeholder?: string;
  multiple?: boolean;
}) =>
  multiple ? (
    <select
      multiple
      aria-label={placeholder}
      value={Array.isArray(value) ? value : []}
      onChange={event => onValueChange?.(Array.from(event.target.selectedOptions, option => option.value))}
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ) : (
    <select aria-label={placeholder} value={value ?? ''} onChange={event => onValueChange?.(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
