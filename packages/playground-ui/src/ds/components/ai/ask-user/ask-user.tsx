import { Check, MessageCircleQuestion } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent, ComponentProps, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
import { Field, FieldItem, FieldLabel, Fieldset, FieldsetLegend } from '@/ds/components/Field';
import type { FieldLabelProps } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export type AskUserSelectionMode = 'single_select' | 'multi_select';
export type AskUserAnswer = string | string[];

export interface AskUserOption {
  label: string;
  description?: string;
}

export interface AskUserPayload {
  question: string;
  options?: AskUserOption[];
  selectionMode?: AskUserSelectionMode;
}

export interface AskUserResult {
  content: string;
  isError?: boolean;
}

export const AskUserContainer = ({ className, ...props }: ComponentProps<'div'>) => (
  <div
    data-slot="ask-user"
    className={cn(raisedSurfaceStyle, 'w-full overflow-hidden rounded-xl', className)}
    {...props}
  />
);

export const AskUserLabel = ({ children = 'Question', className, ...props }: ComponentProps<'div'>) => (
  <div data-slot="ask-user-label" className={cn('flex min-h-10 items-center gap-2 px-4 pt-3', className)} {...props}>
    <Icon size="xs" className="text-muted-foreground">
      <MessageCircleQuestion />
    </Icon>
    <Txt as="span" variant="caption" tone="muted">
      {children}
    </Txt>
  </div>
);

export const AskUserBody = ({ className, ...props }: ComponentProps<'div'>) => (
  <div data-slot="ask-user-body" className={cn('px-4 pt-1 pb-4', className)} {...props} />
);

export const AskUserQuestion = ({ className, ...props }: ComponentProps<typeof Txt>) => (
  <Txt as="p" variant="subheading" tone="ink" {...props} className={cn('mb-3', className)} />
);

export interface AskUserOptionRowProps extends Omit<FieldLabelProps, 'children'> {
  control: ReactNode;
  label: string;
  description?: string;
  disabled?: boolean;
}

export const AskUserOptionRow = ({
  control,
  label,
  description,
  disabled = false,
  className,
  ...props
}: AskUserOptionRowProps) => (
  <FieldItem disabled={disabled} className="contents">
    <FieldLabel
      // state-layer's wash only stops at :disabled/aria-disabled, and a <label> is neither
      aria-disabled={disabled || undefined}
      className={cn(
        'state-layer flex items-start gap-2.5 rounded-lg bg-fill px-3 py-2 data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {control}
      <span className="grid gap-0.5">
        <Txt as="span" variant="body" tone="ink">
          {label}
        </Txt>
        {description ? (
          <Txt as="span" variant="caption" tone="muted">
            {description}
          </Txt>
        ) : null}
      </span>
    </FieldLabel>
  </FieldItem>
);

export type AskUserSubmitProps = Omit<ComponentProps<typeof Button>, 'children'> & { children?: ReactNode };

export const AskUserSubmit = ({ children = 'Submit answer', ...props }: AskUserSubmitProps) => (
  <Button icon={<Check />} type="button" size="sm" variant="primary" {...props}>
    {children}
  </Button>
);

export const AskUserPending = ({ children = 'Submitting…', ...props }: ComponentProps<typeof Txt>) => (
  <Txt as="span" role="status" variant="caption" tone="muted" {...props}>
    {children}
  </Txt>
);

export interface AskUserOutputProps extends ComponentProps<'div'> {
  result: AskUserResult;
}

export const AskUserOutput = ({ result, className, ...props }: AskUserOutputProps) => (
  <div
    data-slot="ask-user-output"
    role={result.isError ? 'alert' : 'status'}
    className={cn('grid gap-2 rounded-lg bg-fill p-3', className)}
    {...props}
  >
    <Badge size="xs" variant={result.isError ? 'destructive' : 'success'} className="justify-self-start">
      {result.isError ? 'Error' : 'Answered'}
    </Badge>
    <Txt as="p" variant="body" tone="ink" className={cn(result.isError && 'text-destructive-foreground')}>
      {result.content}
    </Txt>
  </div>
);

export interface AskUserProps extends Omit<ComponentProps<typeof AskUserContainer>, 'children' | 'onSubmit'> {
  payload: AskUserPayload;
  result?: AskUserResult;
  isAnswered?: boolean;
  isSubmitting?: boolean;
  onSubmit: (answer: AskUserAnswer) => void;
  footer?: ReactNode;
}

const getValidOptions = (options: AskUserPayload['options']): AskUserOption[] =>
  options?.filter((option): option is AskUserOption =>
    Boolean(option && typeof option.label === 'string' && option.label),
  ) ?? [];

interface AskUserInputProps extends Pick<
  AskUserProps,
  'payload' | 'result' | 'isAnswered' | 'isSubmitting' | 'onSubmit' | 'footer'
> {
  options: AskUserOption[];
}

// Suggested options use a separate value namespace so their labels cannot
// collide with the UI-only custom answer choice.
const customAnswerValue = 'custom';

function getOptionRadioValue(optionLabel: string): string {
  return `option:${optionLabel}`;
}

function toggleSelectedOptionLabel(selectedOptionLabels: string[], optionLabel: string): string[] {
  if (selectedOptionLabels.includes(optionLabel)) {
    return selectedOptionLabels.filter(selectedLabel => selectedLabel !== optionLabel);
  }
  return [...selectedOptionLabels, optionLabel];
}

interface AskUserAnswerDraft {
  answerText: string;
  selectedOptionLabels: string[];
  isMultiSelect: boolean;
  isCustomAnswerSelected: boolean;
}

function getAnswerToSubmit({
  answerText,
  selectedOptionLabels,
  isMultiSelect,
  isCustomAnswerSelected,
}: AskUserAnswerDraft): AskUserAnswer | undefined {
  const trimmedAnswerText = answerText.trim();
  if (isCustomAnswerSelected && !trimmedAnswerText) return undefined;
  if (!isMultiSelect) return trimmedAnswerText || undefined;

  const answerLabels = isCustomAnswerSelected ? [...selectedOptionLabels, trimmedAnswerText] : selectedOptionLabels;
  return answerLabels.length > 0 ? answerLabels : undefined;
}

interface AskUserCustomOptionRowProps extends Pick<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'onKeyDown' | 'disabled'
> {
  control: ReactNode;
  isSelected: boolean;
}

const AskUserCustomOptionRow = ({
  control,
  isSelected,
  value,
  onChange,
  onKeyDown,
  disabled,
}: AskUserCustomOptionRowProps) => {
  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled || event.target !== event.currentTarget) return;
    if (isSelected) {
      event.currentTarget.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
      return;
    }
    event.currentTarget.querySelector<HTMLElement>('[role="radio"], [role="checkbox"]')?.click();
  };

  return (
    <FieldItem
      role="group"
      aria-label="Custom answer"
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={handleRowClick}
      className={cn(
        'items-start gap-2.5 rounded-lg bg-fill px-3 py-2 data-disabled:opacity-50',
        !isSelected && 'state-layer',
        isSelected && 'border border-border focus-within:border-border-focus',
      )}
    >
      {control}
      {isSelected ? (
        <Input
          type="text"
          aria-label="Your answer"
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="Other…"
          disabled={disabled}
          variant="unstyled"
          className="h-auto min-w-0 flex-1 px-0 text-body"
          autoFocus
        />
      ) : (
        <FieldLabel className="flex-1">
          <Txt as="span" variant="body" tone="ink">
            Other…
          </Txt>
        </FieldLabel>
      )}
    </FieldItem>
  );
};

const AskUserInput = ({
  payload,
  options,
  result,
  isAnswered = false,
  isSubmitting = false,
  onSubmit,
  footer,
}: AskUserInputProps) => {
  const [answerText, setAnswerText] = useState('');
  const [selectedOptionLabels, setSelectedOptionLabels] = useState<string[]>([]);
  const [isCustomAnswerSelected, setIsCustomAnswerSelected] = useState(false);

  if (result || isAnswered) {
    return (
      <>
        <AskUserQuestion>{payload.question}</AskUserQuestion>
        {result ? <AskUserOutput result={result} /> : <Badge variant="success">Answered</Badge>}
      </>
    );
  }

  const isMultiSelect = options.length > 0 && payload.selectionMode === 'multi_select';
  const answerToSubmit = getAnswerToSubmit({
    answerText,
    selectedOptionLabels,
    isMultiSelect,
    isCustomAnswerSelected,
  });
  const canSubmitAnswer = !isSubmitting && answerToSubmit !== undefined;

  const handleSubmitAnswer = () => {
    if (isSubmitting || answerToSubmit === undefined) return;
    onSubmit(answerToSubmit);
  };

  const handleAnswerTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAnswerText(event.target.value);
  };

  const handleAnswerTextKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmitAnswer();
    }
  };

  const handleOptionToggle = (optionLabel: string) => {
    if (isSubmitting) return;
    setSelectedOptionLabels(currentLabels => toggleSelectedOptionLabel(currentLabels, optionLabel));
  };

  const handleCustomAnswerCheckedChange = (checked: boolean) => {
    if (isSubmitting) return;
    setIsCustomAnswerSelected(checked);
  };

  const handleSingleSelectChange = (radioValue: unknown) => {
    if (isSubmitting) return;
    if (radioValue === customAnswerValue) {
      setIsCustomAnswerSelected(true);
      setSelectedOptionLabels([]);
      return;
    }

    const selectedOption = options.find(option => getOptionRadioValue(option.label) === radioValue);
    if (!selectedOption) return;
    setIsCustomAnswerSelected(false);
    setSelectedOptionLabels([selectedOption.label]);
    onSubmit(selectedOption.label);
  };

  if (options.length === 0) {
    return (
      <>
        <Field>
          <FieldLabel className="text-subheading">{payload.question}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              value={answerText}
              onChange={handleAnswerTextChange}
              onKeyDown={handleAnswerTextKeyDown}
              placeholder="Type your answer..."
              disabled={isSubmitting}
              size="sm"
            />
            <AskUserSubmit
              className="shrink-0 whitespace-nowrap"
              disabled={!canSubmitAnswer}
              onClick={handleSubmitAnswer}
            />
          </div>
        </Field>
        {isSubmitting ? <AskUserPending className="mt-2 block" /> : null}
        {footer}
      </>
    );
  }

  const selectedOptionLabel = selectedOptionLabels[0];
  const selectedOptionValue = selectedOptionLabel === undefined ? '' : getOptionRadioValue(selectedOptionLabel);
  const selectedRadioValue = isCustomAnswerSelected ? customAnswerValue : selectedOptionValue;

  return (
    <>
      {isMultiSelect ? (
        <Fieldset className="gap-2">
          <FieldsetLegend className="mb-1 text-subheading">{payload.question}</FieldsetLegend>
          {options.map(option => (
            <AskUserOptionRow
              key={option.label}
              label={option.label}
              description={option.description}
              disabled={isSubmitting}
              control={
                <Checkbox
                  className="mt-0.5"
                  disabled={isSubmitting}
                  checked={selectedOptionLabels.includes(option.label)}
                  onCheckedChange={() => handleOptionToggle(option.label)}
                />
              }
            />
          ))}
          <AskUserCustomOptionRow
            isSelected={isCustomAnswerSelected}
            value={answerText}
            onChange={handleAnswerTextChange}
            onKeyDown={handleAnswerTextKeyDown}
            disabled={isSubmitting}
            control={
              <Checkbox
                className="mt-0.5"
                aria-label="Other…"
                disabled={isSubmitting}
                checked={isCustomAnswerSelected}
                onCheckedChange={handleCustomAnswerCheckedChange}
              />
            }
          />
          <AskUserSubmit className="mt-1 justify-self-start" disabled={!canSubmitAnswer} onClick={handleSubmitAnswer}>
            Submit answer
          </AskUserSubmit>
        </Fieldset>
      ) : (
        <Fieldset
          className="gap-2"
          render={
            <RadioGroup disabled={isSubmitting} value={selectedRadioValue} onValueChange={handleSingleSelectChange} />
          }
        >
          <FieldsetLegend className="mb-1 text-subheading">{payload.question}</FieldsetLegend>
          {options.map(option => (
            <AskUserOptionRow
              key={option.label}
              label={option.label}
              description={option.description}
              disabled={isSubmitting}
              control={<RadioGroupItem className="mt-0.5" value={getOptionRadioValue(option.label)} />}
            />
          ))}
          <AskUserCustomOptionRow
            isSelected={isCustomAnswerSelected}
            value={answerText}
            onChange={handleAnswerTextChange}
            onKeyDown={handleAnswerTextKeyDown}
            disabled={isSubmitting}
            control={<RadioGroupItem aria-label="Other…" className="mt-0.5" value={customAnswerValue} />}
          />
        </Fieldset>
      )}
      {!isMultiSelect && isCustomAnswerSelected ? (
        <div className="mt-2 grid gap-2">
          <AskUserSubmit className="justify-self-start" disabled={!canSubmitAnswer} onClick={handleSubmitAnswer} />
        </div>
      ) : null}
      {isSubmitting ? <AskUserPending className="mt-3 block" /> : null}
      {footer}
    </>
  );
};

export const AskUser = ({ payload, result, isAnswered, isSubmitting, onSubmit, footer, ...props }: AskUserProps) => {
  const options = getValidOptions(payload.options);
  const payloadKey = JSON.stringify([payload.question, options.map(option => option.label), payload.selectionMode]);

  return (
    <AskUserContainer data-testid="ask-user" {...props}>
      <AskUserLabel />
      <AskUserBody>
        <AskUserInput
          key={payloadKey}
          payload={payload}
          options={options}
          result={result}
          isAnswered={isAnswered}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
          footer={footer}
        />
      </AskUserBody>
    </AskUserContainer>
  );
};
