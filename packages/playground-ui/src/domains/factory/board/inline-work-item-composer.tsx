import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import type { BoardStageId } from './board-icons';
import { IntakeIcon } from './intake-icon';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Metadata } from '@/ds/components/Metadata';

import { Txt } from '@/ds/components/Txt';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { cn } from '@/utils/cn';

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
        'relative flex flex-col gap-3 rounded-card border border-surface-rim bg-fill-subtle p-2 transition-colors outline-none focus-within:border-border-focus motion-reduce:transition-none',
        error !== undefined && 'border-destructive-indicator',
      )}
      onSubmit={event => void submit(event)}
    >
      <Txt as="span" variant="meta" tone="faint" className="truncate pr-14">
        <Metadata singleLine>
          <Metadata.Item>Manual</Metadata.Item>
          <Metadata.Item>new</Metadata.Item>
        </Metadata>
      </Txt>
      <div className="flex min-w-0 items-center gap-1.5">
        <IntakeIcon className="shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          variant="unstyled"
          autoFocus
          aria-label="Work item title"
          autoComplete="off"
          className="h-auto min-w-0 flex-1 p-0 text-card-title-strong text-foreground placeholder:text-muted-foreground"
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
          placeholder="Type a name"
          readOnly={submitting}
          aria-invalid={error !== undefined || undefined}
        />
      </div>
      <div className="absolute top-2 right-2 flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cancel new work item"
          onClick={close}
          disabled={submitting}
        >
          <IconCrossMedium aria-hidden />
        </Button>
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label={`Add work item to ${stageLabel}`}
          disabled={!trimmedTitle}
          loading={submitting}
        >
          <IconCheckmark2Medium aria-hidden />
        </Button>
      </div>
      {error ? (
        <Txt variant="meta" className="m-0 text-destructive-foreground" role="alert">
          {error}
        </Txt>
      ) : null}
    </form>
  );
}
