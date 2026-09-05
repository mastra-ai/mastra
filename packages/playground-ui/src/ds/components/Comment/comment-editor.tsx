import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export interface CommentEditorProps {
  initialBody: string;
  /** Rejecting keeps the editor open with what was typed, so a failed save loses nothing. */
  onSave?: (body: string) => Promise<void>;
  onClose: () => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * Owns the draft so a failed save keeps what was typed; closing is the parent's
 * call, and only ever happens on a save that landed or on cancel.
 */
export function CommentEditor({
  initialBody,
  onSave,
  onClose,
  'aria-label': ariaLabel = 'Edit comment',
  className,
}: CommentEditorProps) {
  const [draft, setDraft] = useState(initialBody);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const body = draft.trim();
    if (body.length === 0) {
      setError('Comment body must not be empty.');
      return;
    }
    if (body === initialBody) {
      onClose();
      return;
    }
    // One save in flight per row: a second one would carry the same expected
    // revision and race its own predecessor.
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSave?.(body);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save comment');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // An IME commit fires Enter mid-composition; acting on it would save half a word.
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <div data-slot="comment-editor" className={cn('mt-1 flex flex-col gap-1.5', className)}>
      <div className="relative">
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label={ariaLabel}
          rows={2}
          className="text-neutral6 border-border1 bg-surface2 text-ui-sm focus:border-border2 block field-sizing-content max-h-40 w-full resize-none overflow-y-auto rounded-lg border px-2 pt-1.5 pb-9 outline-none"
        />
        {/* Opaque, so a scrolled line passes behind the actions instead of under them. */}
        <div className="bg-surface2 absolute inset-x-px bottom-px flex items-center justify-end gap-1 rounded-b-lg px-1.5 pt-1 pb-1.5">
          <Button type="button" variant="ghost" size="xs" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="outline" size="xs" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-ui-xs text-error m-0">
          {error}
        </p>
      ) : null}
    </div>
  );
}
