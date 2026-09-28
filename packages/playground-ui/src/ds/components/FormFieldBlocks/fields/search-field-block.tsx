import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { Button } from '../../Button';
import { Input } from '../../Input';
import type { InputProps } from '../../Input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../Tooltip';
import { FieldBlock } from '../block/field-block';
import type { FieldBlockProps } from '../block/field-block';
import { cn } from '@/lib/utils';

export type SearchFieldBlockProps = Omit<FieldBlockProps, 'children' | 'describedBy' | 'label'> & {
  label?: string;
  testId?: string;
  value?: string;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReset?: () => void;
  error?: boolean;
  size?: InputProps['size'];
  isMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  /** Gives the caller access to the underlying input, e.g. to focus it from a keyboard shortcut. */
  inputRef?: RefObject<HTMLInputElement | null>;
};

export function SearchFieldBlock({
  name,
  label,
  labelIsHidden,
  labelSize,
  layout,
  labelColumnWidth,
  required = false,
  disabled = false,
  helpText,
  error,
  errorMsg,
  className,
  testId,
  value,
  placeholder = 'Search...',
  onChange,
  onReset,
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
    <FieldBlock
      name={name}
      label={label}
      labelIsHidden={labelIsHidden}
      labelSize={labelSize}
      layout={layout}
      labelColumnWidth={labelColumnWidth}
      required={required}
      disabled={disabled}
      helpText={helpText}
      errorMsg={errorMsg}
      className={className}
    >
      {control => (
        <div className="group relative">
          <Input
            {...control}
            ref={setInputRef}
            name={name}
            disabled={disabled}
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            size={size}
            testId={testId}
            error={error || Boolean(errorMsg)}
            className={cn(size === 'sm' && 'px-8', (!size || size === 'md') && 'px-9', size === 'lg' && 'px-10')}
          />
          <SearchIcon
            aria-hidden="true"
            className={cn(
              'absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground',
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
      )}
    </FieldBlock>
  );
}
