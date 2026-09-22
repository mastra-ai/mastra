import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { Button } from '../../Button';
import { Input } from '../../Input';
import type { InputProps } from '../../Input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../Tooltip';
import { FieldBlock } from '../block/field-block';
import { fieldErrorId } from '../block/field-error-id';
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
  isMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  /** Gives the caller access to the underlying input, e.g. to focus it from a keyboard shortcut. */
  inputRef?: RefObject<HTMLInputElement | null>;
};

export function SearchFieldBlock({
  name,
  helpText,
  error,
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
  isMinimized,
  onMinimizedChange,
  inputRef: externalInputRef,
}: SearchFieldBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const setInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element;
    if (externalInputRef) externalInputRef.current = element;
  };
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
            size={size || 'sm'}
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
          <FieldBlock.Label name={name} required={required} disabled={disabled}>
            {label}
          </FieldBlock.Label>
        </FieldBlock.Column>
      ) : null}
      <FieldBlock.Column className={layout === 'horizontal' && labelIsHidden ? 'col-span-full' : undefined}>
        {layout === 'vertical' && label ? (
          <FieldBlock.Label
            name={name}
            required={required}
            disabled={disabled}
            className={labelIsHidden ? 'sr-only' : undefined}
          >
            {label}
          </FieldBlock.Label>
        ) : null}
        <FieldBlock.Column className="gap-1">
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
              error={error || Boolean(errorMsg)}
              aria-describedby={errorMsg ? fieldErrorId(name) : undefined}
              className={cn(
                size === 'xs' && 'px-7',
                size === 'sm' && 'px-8',
                (!size || size === 'md') && 'px-9',
                size === 'lg' && 'px-10',
              )}
            />
            <SearchIcon
              aria-hidden="true"
              className={cn(
                'absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground',
                size === 'xs' && 'size-3',
                size === 'sm' && 'size-3.5',
                (!size || size === 'md') && 'size-4',
                size === 'lg' && 'size-[1.125rem]',
              )}
            />
            {onReset && (value || isMinimized === false) && (
              <Button
                variant="ghost"
                size={size || 'md'}
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
          {helpText || errorMsg ? <FieldBlock.Message name={name} helpText={helpText} errorMsg={errorMsg} /> : null}
        </FieldBlock.Column>
      </FieldBlock.Column>
    </FieldBlock.Layout>
  );
}
