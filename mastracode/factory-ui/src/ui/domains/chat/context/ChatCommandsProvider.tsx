import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import type { SlashCommand } from '../services/commands';
import { useChatCommandRegistry } from './useChatCommandRegistry';

export interface ChatCommandsApi {
  composerDraft: string;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  setComposerDraft: (draft: string) => void;
  prefillComposer: (draft: string) => void;
  commands: SlashCommand[];
  runComposerCommand: (text: string) => Promise<boolean>;
}

const ChatCommandsContext = createContext<ChatCommandsApi | null>(null);

export function ChatCommandsProvider({ children }: { children: ReactNode }) {
  const [composerDraft, setComposerDraft] = useState('');
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const prefillComposer = (draft: string) => {
    setComposerDraft(draft);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };
  const { commands, runComposerCommand } = useChatCommandRegistry(prefillComposer);

  const value: ChatCommandsApi = {
    composerDraft,
    composerInputRef,
    setComposerDraft,
    prefillComposer,
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
