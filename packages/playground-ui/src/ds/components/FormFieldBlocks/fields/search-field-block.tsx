import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '../../Button';
import { Input } from '../../Input';
import type { InputProps } from '../../Input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../Tooltip';
import { FieldBlock } from '../block/field-block';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
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
}: SearchFieldBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
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
        <FieldBlock.Column>
          <FieldBlock.Label name={name} required={required}>
            {labelIsHidden ? <VisuallyHidden>{label}</VisuallyHidden> : label}
          </FieldBlock.Label>
        </FieldBlock.Column>
      ) : null}
      <FieldBlock.Column>
        {layout === 'vertical' && label ? (
          <FieldBlock.Label name={name} required={required}>
            {labelIsHidden ? <VisuallyHidden>{label}</VisuallyHidden> : label}
          </FieldBlock.Label>
        ) : null}
        <div className="group relative">
          <Input
            ref={inputRef}
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
