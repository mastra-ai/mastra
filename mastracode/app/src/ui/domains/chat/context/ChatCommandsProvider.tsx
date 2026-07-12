import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import type { SlashCommand } from '../services/commands';
import { useRunPaletteCommand } from './useRunPaletteCommand';

export interface ChatCommandsApi {
  composerCommandName: string | undefined;
  clearComposerCommand: () => void;
  run: (command: SlashCommand) => void;
  runComposerCommand: (text: string) => Promise<boolean>;
}

const ChatCommandsContext = createContext<ChatCommandsApi | null>(null);

export function ChatCommandsProvider({ children }: { children: ReactNode }) {
  const [composerCommandName, setComposerCommandName] = useState<string | undefined>();
  const { run, runComposerCommand } = useRunPaletteCommand(setComposerCommandName);

  const clearComposerCommand = () => setComposerCommandName(undefined);
  const value: ChatCommandsApi = { composerCommandName, clearComposerCommand, run, runComposerCommand };

  return <ChatCommandsContext.Provider value={value}>{children}</ChatCommandsContext.Provider>;
}

export function useChatCommands(): ChatCommandsApi {
  const ctx = useContext(ChatCommandsContext);
  if (!ctx) throw new Error('useChatCommands must be used within a ChatCommandsProvider');
  return ctx;
}
