import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { Button } from '../../Button';
import { Input } from '../../Input';
import type { InputProps } from '../../Input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../Tooltip';
import { FieldBlock } from '../block/field-block';
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
  variant?: InputProps['variant'];
  isMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  /** Gives the caller access to the underlying input, e.g. to focus it from a keyboard shortcut. */
  inputRef?: RefObject<HTMLInputElement | null>;
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
  variant,
  isMinimized,
  onMinimizedChange,
  inputRef: externalInputRef,
}: SearchFieldBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const setInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element;
    if (externalInputRef) externalInputRef.current = element;
  };
  const buttonSize = size === 'default' ? 'lg' : size;

  useEffect(() => {
    if (isMinimized === false) {
      inputRef.current?.focus();
    }
  }, [isMinimized]);

  if (isMinimized) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={buttonSize || 'sm'}
            aria-label={label || 'Search'}
            disabled={disabled}
            onClick={() => onMinimizedChange?.(false)}
          >
            <SearchIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label || 'Search'}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <FieldBlock.Layout layout={layout} className={className}>
      {layout === 'horizontal' ? (
        <FieldBlock.Column className={labelIsHidden ? 'sr-only' : undefined}>
          <FieldBlock.Label name={name} required={required}>
            {label}
          </FieldBlock.Label>
        </FieldBlock.Column>
      ) : null}
      <FieldBlock.Column className={layout === 'horizontal' && labelIsHidden ? 'col-span-full' : undefined}>
        {layout === 'vertical' && label ? (
          <FieldBlock.Label name={name} required={required} className={labelIsHidden ? 'sr-only' : undefined}>
            {label}
          </FieldBlock.Label>
        ) : null}
        <div className="group relative">
          <Input
            ref={setInputRef}
            id={`input-${name}`}
            name={name}
            disabled={disabled}
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            size={size}
            variant={variant}
            className={cn(
              size === 'sm' && 'px-8',
              size === 'md' && 'px-9',
              (!size || size === 'default') && 'px-10',
              size === 'lg' && 'px-11',
            )}
          />
          <SearchIcon
            aria-hidden="true"
            className={cn(
              'absolute top-1/2 left-3 -translate-y-1/2 text-neutral4 opacity-50 group-has-focus:opacity-100',
              size === 'sm' && 'size-3.5',
              size === 'md' && 'size-4',
              (!size || size === 'default') && 'size-[1.125rem]',
              size === 'lg' && 'size-5',
            )}
          />
          {onReset && (value || isMinimized === false) && (
            <Button
              variant="ghost"
              size={buttonSize || 'lg'}
              aria-label="Clear search"
              onClick={() => {
                if (value) {
                  onReset();
                }
                if (isMinimized === false) {
                  onMinimizedChange?.(true);
                }
              }}
              className="absolute top-1/2 right-0 -translate-y-1/2"
            >
              <XIcon />
            </Button>
          )}
        </div>
        {helpText && <FieldBlock.HelpText>{helpText}</FieldBlock.HelpText>}
        {errorMsg && <FieldBlock.ErrorMsg>{errorMsg}</FieldBlock.ErrorMsg>}
      </FieldBlock.Column>
    </FieldBlock.Layout>
  );
}
