import { createContext, useContext } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

import type { SlashCommand } from '../services/commands';

export interface ComposerPreview {
  text: string;
  height: number;
}

export interface ChatCommandsApi {
  composerDraft: string;
  composerPreview: ComposerPreview | undefined;
  composerInputRef: RefObject<HTMLTextAreaElement | null>;
  setComposerDraft: Dispatch<SetStateAction<string>>;
  showComposerPreview: (text: string) => void;
  clearComposerPreview: (text: string) => void;
  prefillComposer: (draft: string) => void;
  restoreComposerDraft: (draft: string) => void;
  submitComposer: (draft: string) => void;
  commands: SlashCommand[];
  runComposerCommand: (text: string) => Promise<boolean>;
}

export const ChatCommandsContext = createContext<ChatCommandsApi | null>(null);

export function useChatCommands(): ChatCommandsApi {
  const ctx = useContext(ChatCommandsContext);
  if (!ctx) throw new Error('useChatCommands must be used within a ChatCommandsProvider');
  return ctx;
}
