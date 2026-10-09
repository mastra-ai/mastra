import type { ComponentProps, ReactNode } from 'react';
import { useAskUserContext } from './ask-user-context';
import {
  AskUserCustomAnswer,
  AskUserOptionItem,
  AskUserOptions,
  AskUserSubmit,
  AskUserTextAnswer,
} from './ask-user-controls';
import { AskUserBody, AskUserContainer, AskUserOutput, AskUserPending, AskUserQuestion } from './ask-user-layout';
import { AskUserRoot } from './ask-user-root';
import type { AskUserAnswer, AskUserOption, AskUserPayload, AskUserResult } from './ask-user-types';
import { Badge } from '@/ds/components/Badge';

export interface AskUserProps extends Omit<ComponentProps<typeof AskUserContainer>, 'children' | 'onSubmit'> {
  payload: AskUserPayload;
  result?: AskUserResult;
  isAnswered?: boolean;
  isSubmitting?: boolean;
  onSubmit: (answer: AskUserAnswer) => void;
  footer?: ReactNode;
}

function getValidOptions(options: AskUserPayload['options']): AskUserOption[] {
  return (
    options?.filter((option): option is AskUserOption =>
      Boolean(option && typeof option.label === 'string' && option.label),
    ) ?? []
  );
}

function AskUserAnswerControls({ options }: { options: AskUserOption[] }) {
  const { selectionMode } = useAskUserContext();
  const isMultiSelect = selectionMode === 'multi_select';
  if (options.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <AskUserTextAnswer />
        <AskUserSubmit className="shrink-0 whitespace-nowrap" />
      </div>
    );
  }

  return (
    <>
      <AskUserOptions>
        {options.map(option => (
          <AskUserOptionItem key={option.label} value={option.label} description={option.description}>
            {option.label}
          </AskUserOptionItem>
        ))}
        <AskUserCustomAnswer />
        {isMultiSelect ? <AskUserSubmit className="mt-1 justify-self-start" /> : null}
      </AskUserOptions>
      {!isMultiSelect ? <AskUserSubmit when="custom-answer" className="mt-2" /> : null}
    </>
  );
}

interface AskUserCardContentProps extends Pick<AskUserProps, 'result' | 'isAnswered' | 'isSubmitting' | 'footer'> {
  options: AskUserOption[];
}

function AskUserCardContent({ result, isAnswered, isSubmitting, options, footer }: AskUserCardContentProps) {
  if (result) return <AskUserOutput result={result} />;
  if (isAnswered) return <Badge variant="success">Answered</Badge>;

  return (
    <>
      <AskUserAnswerControls options={options} />
      {isSubmitting ? <AskUserPending className="mt-3 block" /> : null}
      {footer}
    </>
  );
}

export function AskUser({
  payload,
  result,
  isAnswered = false,
  isSubmitting = false,
  onSubmit,
  footer,
  ...props
}: AskUserProps) {
  const options = getValidOptions(payload.options);
  const isMultiSelect = options.length > 0 && payload.selectionMode === 'multi_select';
  const payloadKey = JSON.stringify([payload.question, options.map(option => option.label), payload.selectionMode]);
  const hasAnswer = result !== undefined || isAnswered;

  return (
    <AskUserRoot
      key={payloadKey}
      data-testid="ask-user"
      selectionMode={isMultiSelect ? 'multi_select' : 'single_select'}
      disabled={isSubmitting || hasAnswer}
      onSubmit={onSubmit}
      {...props}
    >
      <AskUserBody>
        <AskUserQuestion>{payload.question}</AskUserQuestion>
        <AskUserCardContent
          result={result}
          isAnswered={isAnswered}
          isSubmitting={isSubmitting}
          options={options}
          footer={footer}
        />
      </AskUserBody>
    </AskUserRoot>
  );
}
