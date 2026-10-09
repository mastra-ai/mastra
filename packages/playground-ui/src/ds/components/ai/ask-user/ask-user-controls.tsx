import type { ChangeEvent, ComponentProps, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useAskUserContext, useOptionalAskUserContext } from './ask-user-context';
import { AskUserOptionRow, AskUserSubmitButton } from './ask-user-layout';
import { Checkbox } from '@/ds/components/Checkbox';
import { FieldItem, FieldLabel, Fieldset } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

// Keep the UI-only custom choice separate from suggested answer values.
const customAnswerValue = 'custom';
const optionValuePrefix = 'option:';

function getOptionRadioValue(optionLabel: string): string {
  return `${optionValuePrefix}${optionLabel}`;
}

export function AskUserOptions({ children, className, ...props }: ComponentProps<typeof Fieldset>) {
  const context = useAskUserContext();

  const handleSingleSelectChange = (radioValue: unknown) => {
    if (radioValue === customAnswerValue) {
      context.setCustomAnswerSelected(true);
      return;
    }
    if (typeof radioValue !== 'string' || !radioValue.startsWith(optionValuePrefix)) return;
    context.selectOption(radioValue.slice(optionValuePrefix.length));
  };

  if (context.selectionMode === 'multi_select') {
    return (
      <Fieldset aria-label="Answer options" {...props} className={cn('gap-2', className)}>
        {children}
      </Fieldset>
    );
  }

  const selectedOptionLabel = context.selectedOptionLabels[0];
  const selectedOptionValue = selectedOptionLabel === undefined ? '' : getOptionRadioValue(selectedOptionLabel);
  const selectedRadioValue = context.isCustomAnswerSelected ? customAnswerValue : selectedOptionValue;

  return (
    <Fieldset
      {...props}
      className={cn('gap-2', className)}
      render={
        <RadioGroup
          aria-labelledby={context.questionId}
          disabled={context.disabled}
          value={selectedRadioValue}
          onValueChange={handleSingleSelectChange}
        />
      }
    >
      {children}
    </Fieldset>
  );
}

export interface AskUserOptionItemProps {
  value: string;
  children: ReactNode;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function AskUserOptionItem({
  value,
  children,
  description,
  disabled = false,
  className,
}: AskUserOptionItemProps) {
  const context = useAskUserContext();
  const isDisabled = context.disabled || disabled;

  const handleOptionToggle = () => {
    if (!isDisabled) context.selectOption(value);
  };

  return (
    <AskUserOptionRow
      label={children}
      description={description}
      disabled={isDisabled}
      className={className}
      control={
        context.selectionMode === 'multi_select' ? (
          <Checkbox
            className="mt-0.5"
            disabled={isDisabled}
            checked={context.selectedOptionLabels.includes(value)}
            onCheckedChange={handleOptionToggle}
          />
        ) : (
          <RadioGroupItem className="mt-0.5" disabled={isDisabled} value={getOptionRadioValue(value)} />
        )
      }
    />
  );
}

export type AskUserTextAnswerProps = Omit<
  ComponentProps<typeof Input>,
  'value' | 'defaultValue' | 'onChange' | 'onKeyDown'
>;

export function AskUserTextAnswer({ disabled = false, ...props }: AskUserTextAnswerProps) {
  const context = useAskUserContext();

  const handleAnswerTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    context.changeAnswerText(event.target.value);
  };

  const handleAnswerTextKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      context.submitAnswer();
    }
  };

  return (
    <Input
      type="text"
      aria-labelledby={props['aria-label'] ? undefined : context.questionId}
      placeholder="Type your answer..."
      size="sm"
      {...props}
      disabled={context.disabled || disabled}
      value={context.answerText}
      onChange={handleAnswerTextChange}
      onKeyDown={handleAnswerTextKeyDown}
    />
  );
}

export interface AskUserCustomAnswerProps {
  className?: string;
  label?: string;
  inputLabel?: string;
}

export function AskUserCustomAnswer({
  className,
  label = 'Other…',
  inputLabel = 'Your answer',
}: AskUserCustomAnswerProps) {
  const context = useAskUserContext();

  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if (context.disabled || event.target !== event.currentTarget) return;
    if (context.isCustomAnswerSelected) {
      event.currentTarget.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
      return;
    }
    event.currentTarget.querySelector<HTMLElement>('[role="radio"], [role="checkbox"]')?.click();
  };

  const handleControlMouseDown = (event: MouseEvent<HTMLSpanElement>) => {
    // Let the checkbox click unselect it before blur resets its controlled value.
    if (context.isCustomAnswerSelected && !context.answerText.trim()) event.preventDefault();
  };

  return (
    <FieldItem
      role="group"
      aria-label="Custom answer"
      aria-disabled={context.disabled || undefined}
      disabled={context.disabled}
      onClick={handleRowClick}
      className={cn(
        'items-start gap-2.5 rounded-lg px-3 py-2 data-disabled:opacity-50',
        !context.isCustomAnswerSelected && 'state-layer',
        className,
      )}
    >
      {context.selectionMode === 'multi_select' ? (
        <Checkbox
          className="mt-0.5"
          aria-label={label}
          disabled={context.disabled}
          checked={context.isCustomAnswerSelected}
          onMouseDown={handleControlMouseDown}
          onCheckedChange={context.setCustomAnswerSelected}
        />
      ) : (
        <RadioGroupItem aria-label={label} className="mt-0.5" value={customAnswerValue} />
      )}
      {context.isCustomAnswerSelected ? (
        <AskUserTextAnswer
          aria-label={inputLabel}
          onBlur={context.unselectEmptyCustomAnswer}
          placeholder={label}
          variant="unstyled"
          className={cn('h-auto min-w-0 flex-1 px-0', 'text-body')}
          autoFocus
        />
      ) : (
        <FieldLabel className="flex-1">
          <Txt as="span" variant="body" tone="ink">
            {label}
          </Txt>
        </FieldLabel>
      )}
    </FieldItem>
  );
}

export type AskUserSubmitProps = ComponentProps<typeof AskUserSubmitButton> & {
  when?: 'always' | 'custom-answer';
};

export function AskUserSubmit({ when = 'always', disabled = false, onClick, ...props }: AskUserSubmitProps) {
  const context = useOptionalAskUserContext();

  const handleSubmitClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented && !disabled) context?.submitAnswer();
  };

  if (when === 'custom-answer' && !context?.isCustomAnswerSelected) return null;

  return (
    <AskUserSubmitButton
      {...props}
      disabled={disabled || (context !== undefined && !context.canSubmitAnswer)}
      onClick={handleSubmitClick}
    />
  );
}
