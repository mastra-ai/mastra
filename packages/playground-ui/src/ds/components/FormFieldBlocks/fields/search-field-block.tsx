import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from '../../Input';
import type { InputProps } from '../../Input';
import { FieldBlock } from '../block/field-block';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type SearchFieldBlockProps = {
  name: string;
  testId?: string;
  label?: string;
  labelIsHidden?: boolean;
  required?: boolean;
  disabled?: boolean;
  value?: string;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset?: () => void;
  helpText?: string;
  error?: boolean;
  errorMsg?: string;
  layout?: 'horizontal' | 'vertical';
  className?: string;
  size?: InputProps['size'];
};

export function SearchFieldBlock({
  name,
  helpText,
  errorMsg,
  required = false,
  disabled = false,
  value,
  label,
  labelIsHidden = false,
  layout = 'vertical',
  placeholder = 'Search...',
  onChange,
  onReset,
  className,
  size,
}: SearchFieldBlockProps) {
  return (
    <FieldBlock.Layout layout={layout} className={className}>
      {layout === 'horizontal' ? (
        <FieldBlock.Column>
          <FieldBlock.Label name={name} required={required}>
            {labelIsHidden ? <VisuallyHidden>{label}</VisuallyHidden> : label}
          </FieldBlock.Label>
        </FieldBlock.Column>
      ) : null}
      <FieldBlock.Column>
        {layout === 'vertical' && label && !labelIsHidden ? (
          <FieldBlock.Label name={name} required={required}>
            {label}
          </FieldBlock.Label>
        ) : null}
        <div className="relative group">
          <Input
            name={name}
            disabled={disabled}
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            size={size}
            className={cn(
              size === 'sm' && 'pl-8',
              size === 'md' && 'pl-9',
              (!size || size === 'default') && 'pl-10',
              size === 'lg' && 'pl-11',
            )}
          />
          <SearchIcon
            aria-hidden="true"
            className={cn(
              'text-neutral4 opacity-50 group-has-focus:opacity-100 absolute left-3 top-1/2 -translate-y-1/2',
              size === 'sm' && 'w-3.5 h-3.5',
              size === 'md' && 'w-4 h-4',
              (!size || size === 'default') && 'w-[1.125rem] h-[1.125rem]',
              size === 'lg' && 'w-5 h-5',
            )}
          />
          {onReset && value && (
            <button
              type="button"
              onClick={onReset}
              className={cn(
                'absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded',
                transitions.all,
                'hover:bg-surface4',
                '[&>svg]:transition-colors [&>svg]:duration-normal',
                '[&:hover>svg]:text-neutral5',
              )}
            >
              <XIcon className="text-neutral3 w-4 h-4" />
            </button>
          )}
        </div>
        {helpText && <FieldBlock.HelpText>{helpText}</FieldBlock.HelpText>}
        {errorMsg && <FieldBlock.ErrorMsg>{errorMsg}</FieldBlock.ErrorMsg>}
      </FieldBlock.Column>
    </FieldBlock.Layout>
  );
}
