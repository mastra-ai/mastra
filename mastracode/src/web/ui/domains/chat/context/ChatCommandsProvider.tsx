import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useActiveProjectContext } from '../../workspaces';
import { useClearAgentControllerGoalMutation, usePauseAgentControllerGoalMutation, useResumeAgentControllerGoalMutation } from '../hooks/useAgentControllerGoalMutations';
import { useSetPermissionForCategoryMutation } from '../hooks/useAgentControllerPermissionMutations';
import { useAgentControllerPermissions } from '../hooks/useAgentControllerPermissions';
import { useAbortAgentControllerMutation } from '../hooks/useAgentControllerRunMutations';
import type { SlashCommand } from '../services/commands';
import { runNoArgCommand } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatSession } from './ChatSessionProvider';

export interface ChatCommandsApi {
  composerCommandName: string | null;
  clearComposerCommand: () => void;
  runPaletteCommand: (command: SlashCommand) => void;
}

const ChatCommandsContext = createContext<ChatCommandsApi | null>(null);

export function ChatCommandsProvider({ children }: { children: ReactNode }) {
  const { baseUrl } = useApiConfig();
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const { transcript, pushNotice } = useChatSession();
  const [composerCommandName, setComposerCommandName] = useState<string | null>(null);

  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const clearGoalMutation = useClearAgentControllerGoalMutation(hookArgs);
  const pauseGoalMutation = usePauseAgentControllerGoalMutation(hookArgs);
  const resumeGoalMutation = useResumeAgentControllerGoalMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);
  const { data: permissionRules, isLoading: permissionsLoading } = useAgentControllerPermissions(hookArgs);
  const setPermissionForCategoryMutation = useSetPermissionForCategoryMutation(hookArgs);

  const clearComposerCommand = useCallback(() => setComposerCommandName(null), []);

  const runPaletteCommand = useCallback(
    (command: SlashCommand) => {
      if (command.args) {
        setComposerCommandName(command.name);
        return;
      }

      if (command.name === 'permissions' && permissionsLoading) return;

      void runNoArgCommand(command.name, {
        session: {
          clearGoal: () => clearGoalMutation.mutateAsync().then(() => undefined),
          pauseGoal: () => pauseGoalMutation.mutateAsync().then(() => undefined),
          resumeGoal: () => resumeGoalMutation.mutateAsync().then(() => undefined),
          abort: () => abortMutation.mutateAsync().then(() => undefined),
          getPermissions: () => Promise.resolve(permissionRules ?? { categories: {}, tools: {} }),
          setPermissionForCategory: (category, policy) => setPermissionForCategoryMutation.mutateAsync({ category, policy }),
          pushNotice,
        },
        transcript,
        activeProject: activeProject ?? null,
      });
    },
    [
      abortMutation,
      activeProject,
      clearGoalMutation,
      permissionRules,
      permissionsLoading,
      pauseGoalMutation,
      pushNotice,
      resumeGoalMutation,
      setPermissionForCategoryMutation,
      transcript,
    ],
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
