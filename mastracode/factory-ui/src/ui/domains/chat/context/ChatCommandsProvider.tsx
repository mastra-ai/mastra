import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { flushSync } from 'react-dom';

import type { SlashCommand } from '../services/commands';
import { useChatCommandRegistry } from './useChatCommandRegistry';

export interface ComposerPreview {
  text: string;
  height: number;
}

export interface ChatCommandsApi {
  composerDraft: string;
  composerPreview: ComposerPreview | undefined;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  setComposerDraft: (draft: string) => void;
  showComposerPreview: (text: string) => void;
  clearComposerPreview: (text: string) => void;
  prefillComposer: (draft: string) => void;
  submitComposer: (draft: string) => void;
  commands: SlashCommand[];
  runComposerCommand: (text: string) => Promise<boolean>;
}

const ChatCommandsContext = createContext<ChatCommandsApi | null>(null);

export function ChatCommandsProvider({ children }: { children: ReactNode }) {
  const [composerDraft, setComposerDraft] = useState('');
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
    submitComposer,
    commands,
    runComposerCommand,
  };

  return <ChatCommandsContext.Provider value={value}>{children}</ChatCommandsContext.Provider>;
}

export function useChatCommands(): ChatCommandsApi {
  const ctx = useContext(ChatCommandsContext);
  if (!ctx) throw new Error('useChatCommands must be used within a ChatCommandsProvider');
  return ctx;
}
