import { Check, MessageCircleQuestion } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useOptionalAskUserContext } from './ask-user-context';
import type { AskUserResult } from './ask-user-types';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { FieldItem, FieldLabel } from '@/ds/components/Field';
import type { FieldLabelProps } from '@/ds/components/Field';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

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
  <div data-slot="ask-user-body" className={cn('p-4', className)} {...props} />
);

const AskUserQuestionTitle = ({ children }: { children: ReactNode }) => (
  <span className="flex items-start gap-2">
    <Icon size="xs" className={cn('mt-1 shrink-0', 'text-muted-foreground')} aria-hidden>
      <MessageCircleQuestion />
    </Icon>
    <span className="min-w-0">{children}</span>
  </span>
);

export const AskUserQuestion = ({ children, className, ...props }: ComponentProps<typeof Txt>) => {
  const context = useOptionalAskUserContext();
  return (
    <Txt
      as="p"
      variant="subheading"
      tone="ink"
      {...props}
      id={context?.questionId ?? props.id}
      className={cn('mb-3', className)}
    >
      <AskUserQuestionTitle>{children}</AskUserQuestionTitle>
    </Txt>
  );
};

export interface AskUserOptionRowProps extends Omit<FieldLabelProps, 'children'> {
  control: ReactNode;
  label: ReactNode;
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
      className={cn('state-layer flex items-start gap-2.5 rounded-lg px-3 py-2 data-disabled:opacity-50', className)}
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

export type AskUserSubmitButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & { children?: ReactNode };

export const AskUserSubmitButton = ({ children = 'Submit answer', ...props }: AskUserSubmitButtonProps) => (
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
