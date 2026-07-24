import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '../../Button';
import { Input } from '../../Input';
import type { InputProps } from '../../Input';
import { MatchNav, formatMatchCounter } from '../../MatchNav';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../Tooltip';
import { FieldBlock } from '../block/field-block';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

// Right padding reserved for the match-nav overlay: a fixed base per input size for the prev/next
// buttons (2 × 1.75rem), the counter's own padding/gaps and the clear button, plus the counter
// text itself at ~0.45rem per character (text-ui-xs tabular digits, slightly overestimated).
function matchNavPaddingRem(size: InputProps['size'], counterText: string): string {
  const base = size === 'sm' ? 6.25 : size === 'md' ? 6.5 : size === 'lg' ? 7 : 6.75;
  return `${(base + counterText.length * 0.45).toFixed(2)}rem`;
}

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
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  helpText?: string;
  error?: boolean;
  errorMsg?: string;
  layout?: 'horizontal' | 'vertical';
  className?: string;
  size?: InputProps['size'];
  variant?: InputProps['variant'];
  isMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  /**
   * Optional browser-style match navigation. When `matchCount` is provided, the field shows a
   * "current / total" counter and prev/next buttons next to the clear button. Leave these unset to
   * render a plain search field (backward compatible).
   */
  matchCount?: number;
  currentMatch?: number;
  onNext?: () => void;
  onPrev?: () => void;
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
  onKeyDown,
  className,
  size,
  variant,
  isMinimized,
  onMinimizedChange,
  matchCount,
  currentMatch,
  onNext,
  onPrev,
}: SearchFieldBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonSize = size === 'default' ? 'lg' : size;
  const hasMatchNav = matchCount !== undefined;
  const matchNavPadding = hasMatchNav
    ? matchNavPaddingRem(size, formatMatchCounter(currentMatch ?? 0, matchCount))
    : undefined;

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
            onKeyDown={onKeyDown}
            size={size}
            variant={variant}
            className={cn(
              size === 'sm' && (hasMatchNav ? 'pl-8' : 'px-8'),
              size === 'md' && (hasMatchNav ? 'pl-9' : 'px-9'),
              (!size || size === 'default') && (hasMatchNav ? 'pl-10' : 'px-10'),
              size === 'lg' && (hasMatchNav ? 'pl-11' : 'px-11'),
            )}
            // The counter width varies ("1/3" vs "999+/999+"), so the reserved right padding is
            // computed from the rendered counter text instead of a fixed class — long counters
            // must never overlap the typed text.
            style={matchNavPadding ? { paddingRight: matchNavPadding } : undefined}
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
          <div className="absolute top-1/2 right-0 flex -translate-y-1/2 items-center">
            {hasMatchNav && (
              <MatchNav current={currentMatch ?? 0} total={matchCount} onNext={onNext} onPrevious={onPrev} />
            )}
            {onReset && (value || isMinimized === false) && (
              <Button
                type="button"
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
              >
                <XIcon />
              </Button>
            )}
          </div>
        </div>
        {helpText && <FieldBlock.HelpText>{helpText}</FieldBlock.HelpText>}
        {errorMsg && <FieldBlock.ErrorMsg>{errorMsg}</FieldBlock.ErrorMsg>}
      </FieldBlock.Column>
    </FieldBlock.Layout>
  );
}
