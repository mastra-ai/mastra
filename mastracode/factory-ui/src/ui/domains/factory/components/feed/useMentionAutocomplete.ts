import { useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

import type { FactoryMentionMember } from '../../services/members';
import { findMentionQuery, matchMembers, mentionLabel } from './mentions';

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

  // A sent draft empties the box while the caret state still points into the old text.
  const query = findMentionQuery(draft, Math.min(caret, draft.length));
  const queryKey = query && `${query.atIndex}:${query.query}`;
  const activeQuery = queryKey !== undefined && queryKey !== dismissedQuery ? query : undefined;
  const suggestions = activeQuery ? matchMembers(members, activeQuery.query) : [];

  // The textarea makes the edit, so it keeps the caret: React re-renders with the
  // value already in the DOM and leaves the selection alone.
  const pickSuggestion = (index: number) => {
    const member = suggestions[index];
    const textarea = textareaRef.current;
    if (!member || !activeQuery || !textarea) return;
    textarea.focus();
    textarea.setRangeText(`@${mentionLabel(member)} `, activeQuery.atIndex, caret, 'end');
    setDraft(textarea.value);
    setCaret(textarea.selectionStart);
    setActiveIndex(0);
  };

  /** True when the dropdown consumed the key and the composer must not act on it. */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (suggestions.length === 0) return false;
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
  };
}
