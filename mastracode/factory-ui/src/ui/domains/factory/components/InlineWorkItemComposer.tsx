import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@mastra/playground-ui/components/InputGroup';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Check, FileText, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useRef, useState } from 'react';

import type { BoardStageId } from '../stages';

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
      className="flex flex-col gap-1"
      onSubmit={event => void submit(event)}
    >
      <InputGroup variant="outline">
        <InputGroupAddon>
          <FileText aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          autoFocus
          aria-label="Work item title"
          autoComplete="off"
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
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="button" aria-label="Cancel new work item" onClick={close} disabled={submitting}>
            <X aria-hidden />
          </InputGroupButton>
          <InputGroupButton
            type="submit"
            aria-label={`Add work item to ${stageLabel}`}
            disabled={!trimmedTitle || submitting}
          >
            {submitting ? <Spinner size="sm" aria-hidden className="size-3" /> : <Check aria-hidden />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error ? (
        <p className="text-ui-xs text-notice-destructive-fg m-0 px-2" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
