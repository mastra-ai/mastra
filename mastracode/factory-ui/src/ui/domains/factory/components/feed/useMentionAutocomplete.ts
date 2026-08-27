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
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const pendingCaret = useRef<number | null>(null);

  const query = findMentionQuery(draft, caret);
  const queryKey = query ? `${query.start}:${query.query}` : null;
  const open = query !== null && queryKey !== dismissedQuery;
  const suggestions = open ? matchMembers(members, query.query) : [];

  // Applied in a layout effect so the caret lands with the same commit as the
  // new value; a deferred restore (rAF) can fire after the next keystroke.
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  }, [draft, textareaRef]);

  const pick = (index: number) => {
    const member = suggestions[index];
    if (!member || !query) return;
    const next = applyMention(draft, caret, query, member);
    pendingCaret.current = next.caret;
    setDraft(next.text);
    setCaret(next.caret);
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
      pick(activeIndex);
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
    pick,
    handleKeyDown,
    /** Re-reads the caret after a click or an arrow key moved it. */
    syncCaret: () => {
      const el = textareaRef.current;
      if (el) setCaret(el.selectionStart);
    },
    onDraftChange: (caretAfterChange: number) => {
      setCaret(caretAfterChange);
      setActiveIndex(0);
    },
    reset: () => setCaret(0),
  };
}
