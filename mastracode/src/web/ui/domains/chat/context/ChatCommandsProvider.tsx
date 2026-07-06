import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useActiveProjectContext } from '../../workspaces';
import type { SlashCommand } from '../services/commands';
import { runNoArgCommand } from '../services/commands';
import { useChatSession } from './ChatSessionProvider';

/**
 * Shares palette-command state between the command palette (writer) and the
 * composer (reader), which no longer have a common prop-passing parent.
 * Arg-commands park their name in `composerCommandName` so the composer can
 * prefill "/name "; no-arg commands run immediately via `runNoArgCommand`.
 */
export interface ChatCommandsApi {
  /** Command the composer should prefill (set by the palette), if any. */
  composerCommandName: string | null;
  clearComposerCommand: () => void;
  runPaletteCommand: (command: SlashCommand) => void;
}

const ChatCommandsContext = createContext<ChatCommandsApi | null>(null);

export function ChatCommandsProvider({ children }: { children: ReactNode }) {
  const session = useChatSession();
  const { activeProject } = useActiveProjectContext();
  const [composerCommandName, setComposerCommandName] = useState<string | null>(null);

  const clearComposerCommand = useCallback(() => setComposerCommandName(null), []);

  const runPaletteCommand = useCallback(
    (command: SlashCommand) => {
      if (command.args) {
        setComposerCommandName(command.name);
      } else {
        void runNoArgCommand(command.name, {
          session,
          transcript: session.transcript,
          activeProject: activeProject ?? null,
        });
      }
    },
    [session, activeProject],
  );

  const value = useMemo<ChatCommandsApi>(
    () => ({ composerCommandName, clearComposerCommand, runPaletteCommand }),
    [composerCommandName, clearComposerCommand, runPaletteCommand],
  );

  return <ChatCommandsContext.Provider value={value}>{children}</ChatCommandsContext.Provider>;
}

export function useChatCommands(): ChatCommandsApi {
  const ctx = useContext(ChatCommandsContext);
  if (!ctx) throw new Error('useChatCommands must be used within a ChatCommandsProvider');
  return ctx;
}
