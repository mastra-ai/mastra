import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { ChatCommandsContext } from './ChatCommandsContext';
import type { ChatCommandsApi, ComposerPreview } from './ChatCommandsContext';
import { useChatCommandRegistry } from './useChatCommandRegistry';

export function ChatCommandsProvider({ children, initialDraft = '' }: { children: ReactNode; initialDraft?: string }) {
  const [composerDraft, setComposerDraft] = useState(initialDraft);
  const [composerPreview, setPreview] = useState<ComposerPreview>();
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  // Measured before the preview lands: a composer that grew to fit it would move what the pointer is on.
  const showComposerPreview = (text: string) => {
    const height = composerInputRef.current?.getBoundingClientRect().height;
    setPreview(height === undefined ? undefined : { text, height });
  };
  const clearComposerPreview = (text: string) => setPreview(current => (current?.text === text ? undefined : current));
  const prefillComposer = (draft: string) => {
    setComposerDraft(draft);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };
  // Gives back a message that never sent without dropping what was typed since.
  const restoreComposerDraft = (draft: string) => {
    setComposerDraft(current => (current.trim() ? `${draft}\n\n${current}` : draft));
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };
  // Committed before submitting so the composer's own Send path, gates included, reads it.
  const submitComposer = (draft: string) => {
    flushSync(() => setComposerDraft(draft));
    composerInputRef.current?.form?.requestSubmit();
  };
  const { commands, runComposerCommand } = useChatCommandRegistry(prefillComposer);

  const value: ChatCommandsApi = {
    composerDraft,
    composerPreview,
    composerInputRef,
    setComposerDraft,
    showComposerPreview,
    clearComposerPreview,
    prefillComposer,
    restoreComposerDraft,
    submitComposer,
    commands,
    runComposerCommand,
  };

  return <ChatCommandsContext.Provider value={value}>{children}</ChatCommandsContext.Provider>;
}
