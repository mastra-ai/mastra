import type { PermissionPolicy, ToolCategory } from '@mastra/client-js';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useActiveProjectContext } from '../../workspaces';
import {
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
  useSetAgentControllerGoalMutation,
} from '../hooks/useAgentControllerGoalMutations';
import { useSetPermissionForCategoryMutation } from '../hooks/useAgentControllerPermissionMutations';
import { useAgentControllerPermissions } from '../hooks/useAgentControllerPermissions';
import { useAbortAgentControllerMutation, useFollowUpAgentControllerMutation } from '../hooks/useAgentControllerRunMutations';
import { useSwitchAgentControllerModelMutation } from '../hooks/useAgentControllerStateMutations';
import type { SlashCommand } from '../services/commands';
import { runComposerCommand as dispatchComposerCommand, runNoArgCommand } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatSession } from './ChatSessionProvider';

export interface ChatCommandsApi {
  composerCommandName: string | null;
  clearComposerCommand: () => void;
  runComposerCommand: (text: string) => Promise<boolean>;
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
  const setGoalMutation = useSetAgentControllerGoalMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);
  const followUpMutation = useFollowUpAgentControllerMutation(hookArgs);
  const switchModelMutation = useSwitchAgentControllerModelMutation(hookArgs);
  const { data: permissionRules, isLoading: permissionsLoading } = useAgentControllerPermissions(hookArgs);
  const setPermissionForCategoryMutation = useSetPermissionForCategoryMutation(hookArgs);

  const clearComposerCommand = () => setComposerCommandName(null);

  const commandDeps = {
    session: {
      clearGoal: () => clearGoalMutation.mutateAsync().then(() => undefined),
      pauseGoal: () => pauseGoalMutation.mutateAsync().then(() => undefined),
      resumeGoal: () => resumeGoalMutation.mutateAsync().then(() => undefined),
      setGoal: (objective: string) => setGoalMutation.mutateAsync(objective).then(() => undefined),
      followUp: (message: string) => followUpMutation.mutateAsync(message).then(() => undefined),
      switchModel: (modelId: string) => switchModelMutation.mutateAsync(modelId).then(() => undefined),
      abort: () => abortMutation.mutateAsync().then(() => undefined),
      getPermissions: () => Promise.resolve(permissionRules ?? { categories: {}, tools: {} }),
      setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) =>
        setPermissionForCategoryMutation.mutateAsync({ category, policy }),
      pushNotice,
    },
    transcript,
    activeProject: activeProject ?? null,
  };

  const runComposerCommand = (text: string) => {
    if (text === '/permissions' && permissionsLoading) return Promise.resolve(true);
    return dispatchComposerCommand(text, commandDeps);
  };

  const runPaletteCommand = (command: SlashCommand) => {
    if (command.args) {
      setComposerCommandName(command.name);
      return;
    }

    void runNoArgCommand(command.name, commandDeps);
  };

  const value: ChatCommandsApi = { composerCommandName, clearComposerCommand, runComposerCommand, runPaletteCommand };

  return <ChatCommandsContext.Provider value={value}>{children}</ChatCommandsContext.Provider>;
}

export function useChatCommands(): ChatCommandsApi {
  const ctx = useContext(ChatCommandsContext);
  if (!ctx) throw new Error('useChatCommands must be used within a ChatCommandsProvider');
  return ctx;
}
