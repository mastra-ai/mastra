import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useRef, useState } from 'react';

import type { BoardStageId } from '../stages';
import { IntakeIcon } from './IntakeIcon';

interface InlineWorkItemComposerProps {
  stage: BoardStageId;
  stageLabel: string;
  onCreate: (title: string) => Promise<void>;
  onClose: () => void;
}

export function InlineWorkItemComposer({ stage, stageLabel, onCreate, onClose }: InlineWorkItemComposerProps) {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedTitle = title.trim();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedTitle || submitting) return;

    setSubmitting(true);
    setError(undefined);
    try {
      await onCreate(trimmedTitle);
      setSubmitting(false);
      onClose();
    } catch (caught) {
      setSubmitting(false);
      setError(caught instanceof Error ? caught.message : 'Failed to create work item');
      inputRef.current?.focus();
    }
  };

  const close = () => {
    if (!submitting) onClose();
  };

  return (
    <form
      id={`new-work-item-${stage}`}
      aria-label={`New work item in ${stageLabel}`}
      aria-busy={submitting}
      className={cn(
        'relative flex flex-col gap-3 rounded-3xl border border-border1/50 bg-neutral6/5 p-2.5 outline-none transition-colors focus-within:border-neutral5/50 motion-reduce:transition-none',
        error !== undefined && 'border-error',
      )}
      onSubmit={event => void submit(event)}
    >
      <span className="text-ui-xs text-icon2 truncate pr-14">Manual · new</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <IntakeIcon className="text-icon3 shrink-0" />
        <Input
          ref={inputRef}
          variant="unstyled"
          autoFocus
          aria-label="Work item title"
          autoComplete="off"
          className="text-ui-smd text-icon6 placeholder:text-icon4 h-auto min-w-0 flex-1 p-0 font-semibold"
          value={title}
          onChange={event => {
            setTitle(event.target.value);
            if (error !== undefined) setError(undefined);
          }}
          onKeyDown={event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            close();
          }}
          placeholder="Type a name…"
          readOnly={submitting}
          error={error !== undefined}
        />
      </div>
      <div className="absolute top-2 right-2 flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Cancel new work item"
          onClick={close}
          disabled={submitting}
        >
          <X aria-hidden />
        </Button>
        <Button
          type="submit"
          variant="ghost"
          size="icon-xs"
          aria-label={`Add work item to ${stageLabel}`}
          disabled={!trimmedTitle || submitting}
        >
          {submitting ? <Spinner size="sm" aria-hidden className="size-3" /> : <Check aria-hidden />}
        </Button>
      </div>
      {error ? (
        <p className="text-ui-xs text-notice-destructive-fg m-0" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
