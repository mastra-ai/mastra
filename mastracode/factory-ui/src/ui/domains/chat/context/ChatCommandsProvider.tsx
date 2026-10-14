import { createContext, useContext, useRef, useState } from 'react';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';

import type { PendingImage } from '../components/useComposerImages';
import type { SlashCommand } from '../services/commands';
import { useChatCommandRegistry } from './useChatCommandRegistry';

export interface ChatCommandsApi {
  composerDraft: string;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  setComposerDraft: (draft: string) => void;
  composerImages: PendingImage[];
  setComposerImages: Dispatch<SetStateAction<PendingImage[]>>;
  prefillComposer: (draft: string, images?: PendingImage[]) => void;
  commands: SlashCommand[];
  runComposerCommand: (text: string) => Promise<boolean>;
}

const ChatCommandsContext = createContext<ChatCommandsApi | null>(null);

export function ChatCommandsProvider({ children }: { children: ReactNode }) {
  const [composerDraft, setComposerDraft] = useState('');
  const [composerImages, setComposerImages] = useState<PendingImage[]>([]);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const prefillComposer = (draft: string, images?: PendingImage[]) => {
    setComposerDraft(draft);
    if (images?.length) setComposerImages(current => [...images, ...current]);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };
  const { commands, runComposerCommand } = useChatCommandRegistry(prefillComposer);

  const value: ChatCommandsApi = {
    composerDraft,
    composerInputRef,
    setComposerDraft,
    composerImages,
    setComposerImages,
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
