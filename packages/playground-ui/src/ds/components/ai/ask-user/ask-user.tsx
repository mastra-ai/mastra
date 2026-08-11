import { useId, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
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
  <div className={cn('rounded-lg border border-border1 bg-surface2 p-3 text-sm', className)} {...props} />
);

export const AskUserQuestion = ({ className, ...props }: ComponentProps<'legend'>) => (
  <legend className={cn('mb-3 font-medium text-neutral6', className)} {...props} />
);

export const AskUserOptionDescription = ({ className, ...props }: ComponentProps<'span'>) => (
  <span className={cn('block text-ui-xs font-normal text-neutral3', className)} {...props} />
);

interface AskUserOptionControlProps extends Omit<ComponentProps<'input'>, 'type'> {
  type: 'radio' | 'checkbox';
  label: string;
  description?: string;
}

export const AskUserOptionControl = ({ type, label, description, className, ...props }: AskUserOptionControlProps) => (
  <label
    className={cn(
      'flex cursor-pointer items-start gap-2 rounded-md border border-border1 bg-surface3 px-3 py-2 text-neutral5 transition-colors hover:bg-surface4 has-[:checked]:border-border2 has-[:checked]:bg-surface4 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
      className,
    )}
  >
    <input type={type} className="mt-0.5 accent-current" {...props} />
    <span>
      <span className="block">{label}</span>
      {description ? <AskUserOptionDescription>{description}</AskUserOptionDescription> : null}
    </span>
  </label>
);

export const AskUserSubmit = ({ children = 'Submit answer', ...props }: ComponentProps<typeof Button>) => (
  <Button type="button" size="sm" variant="primary" {...props}>
    {children}
  </Button>
);

export const AskUserPending = ({ children = 'Submitting…', className, ...props }: ComponentProps<'span'>) => (
  <span role="status" className={cn('text-ui-xs text-neutral3', className)} {...props}>
    {children}
  </span>
);

export interface AskUserOutputProps extends ComponentProps<'div'> {
  result: AskUserResult;
}

export const AskUserOutput = ({ result, className, ...props }: AskUserOutputProps) => (
  <div
    role={result.isError ? 'alert' : 'status'}
    className={cn('space-y-2 rounded-md bg-surface3 p-3 text-neutral5', result.isError && 'text-error', className)}
    {...props}
  >
    <Badge size="xs" variant={result.isError ? 'error' : 'success'}>
      {result.isError ? 'Error' : 'Answered'}
    </Badge>
    <p>{result.content}</p>
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
  const inputId = useId();
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  if (result || isAnswered) {
    return (
      <AskUserContainer data-testid="ask-user" {...props}>
        <p className="text-neutral6 mb-2 font-medium">{payload.question}</p>
        {result ? <AskUserOutput result={result} /> : <Badge variant="success">Answered</Badge>}
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
        <label className="text-neutral6 mb-2 block font-medium" htmlFor={inputId}>
          {payload.question}
        </label>
        <div className="flex items-center gap-2">
          <Input
            id={inputId}
            value={text}
            onChange={event => setText(event.target.value)}
            onKeyDown={handleTextKeyDown}
            placeholder="Type your answer..."
            disabled={isSubmitting}
            size="sm"
          />
          <AskUserSubmit aria-label="Submit answer" disabled={isSubmitting || !text.trim()} onClick={submitText}>
            Submit
          </AskUserSubmit>
        </div>
        {isSubmitting ? <AskUserPending className="mt-2 block" /> : null}
        {footer}
      </AskUserContainer>
    );
  }

  const isMulti = payload.selectionMode === 'multi_select';
  return (
    <AskUserContainer data-testid="ask-user" {...props}>
      <fieldset disabled={isSubmitting} className="space-y-2">
        <AskUserQuestion>{payload.question}</AskUserQuestion>
        {options.map(option => {
          const checked = selected.includes(option.label);
          return (
            <AskUserOptionControl
              key={option.label}
              type={isMulti ? 'checkbox' : 'radio'}
              name={inputId}
              label={option.label}
              description={option.description}
              disabled={isSubmitting}
              checked={checked}
              onChange={() => {
                if (isSubmitting) return;
                if (!isMulti) {
                  setSelected([option.label]);
                  onSubmit(option.label);
                  return;
                }
                setSelected(current =>
                  current.includes(option.label)
                    ? current.filter(selectedLabel => selectedLabel !== option.label)
                    : [...current, option.label],
                );
              }}
            />
          );
        })}
        {isMulti ? (
          <AskUserSubmit disabled={isSubmitting || selected.length === 0} onClick={() => onSubmit(selected)}>
            Submit answer
          </AskUserSubmit>
        ) : null}
        {isSubmitting ? <AskUserPending /> : null}
        {footer}
      </fieldset>
    </AskUserContainer>
  );
};

export const AskUser = ({ payload, ...props }: AskUserProps) => {
  const options = validOptions(payload.options);
  const payloadKey = JSON.stringify([payload.question, options.map(option => option.label), payload.selectionMode]);

  return <AskUserInput key={payloadKey} payload={payload} options={options} {...props} />;
};
