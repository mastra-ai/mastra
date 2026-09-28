import { Check, X } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Button } from '@/ds/components/Button';
import { Field, FieldError } from '@/ds/components/Field';
import { TextareaControl } from '@/ds/primitives/textarea-control';
import { cn } from '@/lib/utils';

export interface CommentEditorProps {
  initialBody: string;
  /** Handed the trimmed draft. Closing is the caller's call, so a save that failed keeps what was typed. */
  onSave: (body: string) => void;
  onClose: () => void;
  /** The caller's save in flight: the box locks until it settles. */
  isPending?: boolean;
  /** Why the caller's last save failed. */
  error?: string;
  'aria-label'?: string;
  className?: string;
}

/** Owns the draft only; whether a save landed is the caller's mutation to report. */
export function CommentEditor({
  initialBody,
  onSave,
  onClose,
  isPending = false,
  error,
  'aria-label': ariaLabel = 'Edit comment',
  className,
}: CommentEditorProps) {
  const [draft, setDraft] = useState(initialBody);
  const body = draft.trim();
  const canSave = body.length > 0 && !isPending;

  const save = () => {
    if (!canSave) return;
    if (body === initialBody) {
      onClose();
      return;
    }
    onSave(body);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // An IME commit fires Enter mid-composition; acting on it would save half a word.
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      save();
    }
  };

  return (
    <Field invalid={Boolean(error)} data-slot="comment-editor" className={cn('mt-1 flex flex-col gap-1.5', className)}>
      <div className="relative">
        <TextareaControl
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          readOnly={isPending}
          aria-label={ariaLabel}
          rows={2}
          className="block field-sizing-content max-h-40 w-full resize-none overflow-y-auto rounded-lg border border-border bg-background px-2 pt-1.5 pb-9 text-caption text-foreground outline-none focus:border-border-strong"
        />
        {/* Opaque, so a scrolled line passes behind the actions instead of under them. */}
        <div className="absolute inset-x-px bottom-px flex items-center justify-end gap-1 rounded-b-lg bg-background px-1.5 pt-1 pb-1.5">
          <Button icon={<X />} type="button" variant="ghost" size="sm" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<Check />} type="button" size="sm" disabled={!canSave} onClick={save}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
