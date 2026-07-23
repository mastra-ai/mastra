import { createContext, useContext, useRef, useState } from 'react';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';

import type { SlashCommand } from '../services/commands';
import { useRunPaletteCommand } from './useRunPaletteCommand';

export interface PendingComposerImage {
  id: string;
  /** Raw base64 payload (no `data:` prefix). */
  data: string;
  mediaType: string;
  filename?: string;
}

interface ChatComposerStateApi {
  composerDraft: string;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  pendingImages: PendingComposerImage[];
  setComposerDraft: Dispatch<SetStateAction<string>>;
  setPendingImages: Dispatch<SetStateAction<PendingComposerImage[]>>;
}

export interface ChatCommandsApi extends ChatComposerStateApi {
  prefillComposer: (draft: string) => void;
  run: (command: SlashCommand) => void;
  runComposerCommand: (text: string) => Promise<boolean>;
}

const ChatComposerStateContext = createContext<ChatComposerStateApi | null>(null);
const ChatCommandsContext = createContext<ChatCommandsApi | null>(null);

export function ChatComposerStateProvider({ children }: { children: ReactNode }) {
  const [composerDraft, setComposerDraft] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingComposerImage[]>([]);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  return (
    <ChatComposerStateContext.Provider
      value={{ composerDraft, composerInputRef, pendingImages, setComposerDraft, setPendingImages }}
    >
      {children}
    </ChatComposerStateContext.Provider>
  );
}

export function ChatComposerStateBoundary({ children }: { children: ReactNode }) {
  const state = useContext(ChatComposerStateContext);
  return state ? children : <ChatComposerStateProvider>{children}</ChatComposerStateProvider>;
}

export function ChatCommandsProvider({ children }: { children: ReactNode }) {
  const state = useContext(ChatComposerStateContext);
  if (!state) throw new Error('ChatCommandsProvider must be used within a ChatComposerStateProvider');

  const prefillComposer = (draft: string) => {
    state.setComposerDraft(draft);
    requestAnimationFrame(() => state.composerInputRef.current?.focus());
  };
  const { run, runComposerCommand } = useRunPaletteCommand(prefillComposer);

  const value: ChatCommandsApi = {
    ...state,
    prefillComposer,
    run,
    runComposerCommand,
  };

  return <ChatCommandsContext.Provider value={value}>{children}</ChatCommandsContext.Provider>;
}

export function useChatCommands(): ChatCommandsApi {
  const ctx = useContext(ChatCommandsContext);
  if (!ctx) throw new Error('useChatCommands must be used within a ChatCommandsProvider');
  return ctx;
}
