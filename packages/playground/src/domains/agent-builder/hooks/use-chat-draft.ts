import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

interface UseChatDraftArgs {
  onSubmit: (trimmed: string) => void;
}

export const useChatDraft = ({ onSubmit }: UseChatDraftArgs) => {
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!trimmed) return;
    onSubmit(trimmed);
    setDraft('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  return { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown };
};
