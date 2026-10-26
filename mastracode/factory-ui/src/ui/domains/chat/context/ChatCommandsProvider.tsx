import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { flushSync } from 'react-dom';

import type { SlashCommand } from '../services/commands';
import { useChatCommandRegistry } from './useChatCommandRegistry';

export interface ChatCommandsApi {
  composerDraft: string;
  composerPreview: string | null;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  setComposerDraft: (draft: string) => void;
  setComposerPreview: (preview: string | null) => void;
  prefillComposer: (draft: string) => void;
  submitComposer: (draft: string) => void;
  commands: SlashCommand[];
  runComposerCommand: (text: string) => Promise<boolean>;
}

const ChatCommandsContext = createContext<ChatCommandsApi | null>(null);

export function ChatCommandsProvider({ children }: { children: ReactNode }) {
  const [composerDraft, setComposerDraft] = useState('');
  const [composerPreview, setComposerPreview] = useState<string | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
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
    setComposerPreview,
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
