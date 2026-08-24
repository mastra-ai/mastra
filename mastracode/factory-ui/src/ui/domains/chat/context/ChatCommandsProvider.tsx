import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import type { ResolvedChatCommand } from '../services/commands';
import { useChatCommandRegistry } from './useChatCommandRegistry';

export interface ChatCommandsApi {
  composerDraft: string;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  setComposerDraft: (draft: string) => void;
  prefillComposer: (draft: string) => void;
  /** Built-ins merged with runtime commands; consumed by suggestions and /help. */
  commands: ResolvedChatCommand[];
  /** Executes slash input. Returns false when the text is not a command. */
  executeText: (text: string) => Promise<boolean>;
  /** Deduplicated discovery refetch, driven by the composer's slash transition. */
  refreshRuntimeCommands: () => Promise<unknown>;
}

const ChatCommandsContext = createContext<ChatCommandsApi | null>(null);

export function ChatCommandsProvider({ children }: { children: ReactNode }) {
  const [composerDraft, setComposerDraft] = useState('');
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const prefillComposer = (draft: string) => {
    setComposerDraft(draft);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };
  const { commands, executeText, refreshRuntimeCommands } = useChatCommandRegistry(composerDraft, setComposerDraft);

  const value: ChatCommandsApi = {
    composerDraft,
    composerInputRef,
    setComposerDraft,
    prefillComposer,
    commands,
    executeText,
    refreshRuntimeCommands,
  };

  return <ChatCommandsContext.Provider value={value}>{children}</ChatCommandsContext.Provider>;
}

export function useChatCommands(): ChatCommandsApi {
  const ctx = useContext(ChatCommandsContext);
  if (!ctx) throw new Error('useChatCommands must be used within a ChatCommandsProvider');
  return ctx;
}
