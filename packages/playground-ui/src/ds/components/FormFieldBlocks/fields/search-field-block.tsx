import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { SearchIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '../../Input';
import { Button } from '../../Button';
import { transitions } from '@/ds/primitives/transitions';
import { FieldBlock } from '../block/field-block';

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
  size?: 'small' | 'default';
  layout?: 'horizontal' | 'vertical';
};

export function SearchFieldBlock({
  name,
  helpText,
  errorMsg,
  required = false,
  disabled = false,
  size = 'default',
  value,
  label,
  labelIsHidden = false,
  layout = 'vertical',
  placeholder = 'Search...',
  onChange,
  onReset,
}: SearchFieldBlockProps) {
  return (
    <FieldBlock.Layout layout={layout}>
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
            className="pl-10"
          />
          <SearchIcon
            aria-hidden="true"
            className="text-neutral4 opacity-50 group-has-[:focus]:opacity-100 absolute top-2 left-3 w-5 h-5"
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
              <XIcon className="text-neutral3 w-[1rem] h-[1rem]" />
            </button>
          )}
        </div>
        {helpText && <FieldBlock.HelpText>{helpText}</FieldBlock.HelpText>}
        {errorMsg && <FieldBlock.ErrorMsg>{errorMsg}</FieldBlock.ErrorMsg>}
      </FieldBlock.Column>
    </FieldBlock.Layout>
  );
}
