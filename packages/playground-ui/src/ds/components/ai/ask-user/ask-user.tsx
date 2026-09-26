import { Check, MessageCircleQuestion } from 'lucide-react';
import { useId, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
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

export interface AskUserOptionRowProps extends Omit<ComponentProps<'label'>, 'children'> {
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
  <label
    // state-layer's wash only stops at :disabled/aria-disabled, and a <label> is neither
    aria-disabled={disabled || undefined}
    className={cn(
      'state-layer flex items-start gap-2.5 rounded-lg bg-fill px-3 py-2',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
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
  </label>
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
    <Txt as="p" variant="body" tone="ink" className={cn(result.isError && 'text-error')}>
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

const validOptions = (options: AskUserPayload['options']): AskUserOption[] =>
  options?.filter((option): option is AskUserOption =>
    Boolean(option && typeof option.label === 'string' && option.label),
  ) ?? [];

interface AskUserInputProps extends AskUserProps {
  options: AskUserOption[];
}

const AskUserInput = ({
  payload,
  options,
  result,
  isAnswered = false,
  isSubmitting = false,
  onSubmit,
  footer,
  ...props
}: AskUserInputProps) => {
  const fieldId = useId();
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  if (result || isAnswered) {
    return (
      <AskUserContainer data-testid="ask-user" {...props}>
        <AskUserLabel />
        <AskUserBody>
          <AskUserQuestion>{payload.question}</AskUserQuestion>
          {result ? <AskUserOutput result={result} /> : <Badge variant="success">Answered</Badge>}
        </AskUserBody>
      </AskUserContainer>
    );
  }

  const submitText = () => {
    const answer = text.trim();
    if (answer && !isSubmitting) onSubmit(answer);
  };

  const handleTextKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitText();
    }
  };

  if (options.length === 0) {
    return (
      <AskUserContainer data-testid="ask-user" {...props}>
        <AskUserLabel />
        <AskUserBody>
          <AskUserQuestion as="label" htmlFor={fieldId} className="mb-2 block">
            {payload.question}
          </AskUserQuestion>
          <div className="flex items-center gap-2">
            <Input
              id={fieldId}
              value={text}
              onChange={event => setText(event.target.value)}
              onKeyDown={handleTextKeyDown}
              placeholder="Type your answer..."
              disabled={isSubmitting}
              size="sm"
            />
            <AskUserSubmit
              className="shrink-0 whitespace-nowrap"
              disabled={isSubmitting || !text.trim()}
              onClick={submitText}
            />
          </div>
          {isSubmitting ? <AskUserPending className="mt-2 block" /> : null}
          {footer}
        </AskUserBody>
      </AskUserContainer>
    );
  }

  const isMulti = payload.selectionMode === 'multi_select';

  return (
    <AskUserContainer data-testid="ask-user" {...props}>
      <AskUserLabel />
      <AskUserBody>
        <AskUserQuestion id={fieldId}>{payload.question}</AskUserQuestion>
        {isMulti ? (
          <div role="group" aria-labelledby={fieldId} className="grid gap-2">
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
                    checked={selected.includes(option.label)}
                    onCheckedChange={() =>
                      setSelected(current =>
                        current.includes(option.label)
                          ? current.filter(selectedLabel => selectedLabel !== option.label)
                          : [...current, option.label],
                      )
                    }
                  />
                }
              />
            ))}
            <AskUserSubmit
              className="mt-1 justify-self-start"
              disabled={isSubmitting || selected.length === 0}
              onClick={() => onSubmit(selected)}
            >
              Submit answer
            </AskUserSubmit>
          </div>
        ) : (
          <RadioGroup
            aria-labelledby={fieldId}
            disabled={isSubmitting}
            value={selected[0] ?? null}
            onValueChange={value => {
              const label = String(value);
              setSelected([label]);
              onSubmit(label);
            }}
          >
            {options.map(option => (
              <AskUserOptionRow
                key={option.label}
                label={option.label}
                description={option.description}
                disabled={isSubmitting}
                control={<RadioGroupItem className="mt-0.5" value={option.label} />}
              />
            ))}
          </RadioGroup>
        )}
        {isSubmitting ? <AskUserPending className="mt-3 block" /> : null}
        {footer}
      </AskUserBody>
    </AskUserContainer>
  );
};

export const AskUser = ({ payload, ...props }: AskUserProps) => {
  const options = validOptions(payload.options);
  const payloadKey = JSON.stringify([payload.question, options.map(option => option.label), payload.selectionMode]);

  return <AskUserInput key={payloadKey} payload={payload} options={options} {...props} />;
};
