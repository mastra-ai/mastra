import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

import type { FactoryMentionMember } from '../../services/members';
import { applyMention, findMentionQuery, matchMembers } from './mentions';

/**
 * The `@mention` dropdown behind a plain textarea: it owns the caret tracking
 * and the keys it consumes, and hands the composer a draft it can just send.
 */
export function useMentionAutocomplete({
  draft,
  setDraft,
  members,
  textareaRef,
}: {
  draft: string;
  setDraft: (text: string) => void;
  members: FactoryMentionMember[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedQuery, setDismissedQuery] = useState<string>();
  const pendingCaret = useRef<number | undefined>(undefined);

  const query = findMentionQuery(draft, caret);
  const queryKey = query && `${query.atIndex}:${query.query}`;
  const activeQuery = queryKey !== undefined && queryKey !== dismissedQuery ? query : undefined;
  const open = activeQuery !== undefined;
  const suggestions = activeQuery ? matchMembers(members, activeQuery.query) : [];

  // Applied in a layout effect so the caret lands with the same commit as the
  // new value; a deferred restore (rAF) can fire after the next keystroke.
  useLayoutEffect(() => {
    if (pendingCaret.current === undefined) return;
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = undefined;
  }, [draft, textareaRef]);

  const pickSuggestion = (index: number) => {
    const member = suggestions[index];
    if (!member || !activeQuery) return;
    const applied = applyMention(draft, caret, activeQuery, member);
    pendingCaret.current = applied.caret;
    setDraft(applied.text);
    setCaret(applied.caret);
    setActiveIndex(0);
  };

  /** True when the dropdown consumed the key and the composer must not act on it. */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open || suggestions.length === 0) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(index => (index + delta + suggestions.length) % suggestions.length);
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      pickSuggestion(activeIndex);
      return true;
    }
    if (event.key === 'Escape') {
      // Only the dropdown closes: the popover behind must not dismiss with it.
      event.preventDefault();
      event.stopPropagation();
      setDismissedQuery(queryKey);
      return true;
    }
    return false;
  };

  return {
    suggestions,
    activeIndex,
    pickSuggestion,
    handleKeyDown,
    syncCaret: () => {
      const textarea = textareaRef.current;
      if (textarea) setCaret(textarea.selectionStart);
    },
    onDraftChange: (caretAfterChange: number) => {
      setCaret(caretAfterChange);
      setActiveIndex(0);
      // Retyping a dismissed query asks again.
      setDismissedQuery(undefined);
    },
    resetCaret: () => setCaret(0),
  };
}
