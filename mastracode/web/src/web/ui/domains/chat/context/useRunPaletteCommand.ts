import type { ToolCategory } from '@mastra/client-js';
import type { Dispatch, SetStateAction } from 'react';

import { useActiveProjectContext } from '../../workspaces';
import {
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
} from '../hooks/useAgentControllerGoalMutations';
import { useAbortAgentControllerMutation } from '../hooks/useAgentControllerRunMutations';
import type { SlashCommand } from '../services/commands';
import { SLASH_COMMANDS } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatModels } from './useChatModels';
import { useChatModes } from './useChatModes';
import { useChatPermissions } from './useChatPermissions';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatTranscript } from './useChatTranscript';

const TOOL_CATEGORIES: ToolCategory[] = ['read', 'edit', 'execute', 'mcp', 'other'];

export function useRunPaletteCommand(setComposerCommandName: Dispatch<SetStateAction<string | undefined>>) {
  const { activeProject } = useActiveProjectContext();
  const { resourceId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { transcript, pushNotice } = useChatTranscript();
  const { activeModeId } = useChatModes();
  const { activeModelId } = useChatModels();

  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const clearGoalMutation = useClearAgentControllerGoalMutation(hookArgs);
  const pauseGoalMutation = usePauseAgentControllerGoalMutation(hookArgs);
  const resumeGoalMutation = useResumeAgentControllerGoalMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);
  const { permissions, permissionsLoading, setPermissionForCategory } = useChatPermissions();

  const runNoArg = async (name: string) => {
    switch (name) {
      case 'goal-clear':
        await clearGoalMutation.mutateAsync();
        return;
      case 'goal-pause':
        await pauseGoalMutation.mutateAsync();
        return;
      case 'goal-resume':
        await resumeGoalMutation.mutateAsync();
        return;
      case 'permissions': {
        const rules = permissions ?? { categories: {}, tools: {} };
        const cats =
          Object.entries(rules.categories ?? {})
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n') || '  (none)';
        const tools =
          Object.entries(rules.tools ?? {})
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n') || '  (none)';
        pushNotice(`Categories:\n${cats}\nTools:\n${tools}`);
        return;
      }
      case 'yolo':
        for (const cat of TOOL_CATEGORIES) {
          await setPermissionForCategory(cat, 'allow');
        }
        pushNotice('YOLO mode: all tool categories set to auto-allow');
        return;
      case 'cost': {
        const u = transcript.usage;
        pushNotice(
          !u?.totalTokens
            ? 'No token usage recorded yet.'
            : `Tokens — prompt: ${u.promptTokens ?? 0}, completion: ${u.completionTokens ?? 0}, total: ${u.totalTokens}`,
        );
        return;
      }
      case 'think':
        pushNotice('Extended thinking: steer the agent with "think step by step" or switch to a thinking-capable model.');
        return;
      case 'om':
        pushNotice(`Observational memory phase: ${transcript.omPhase ?? 'idle'}`);
        return;
      case 'settings':
        pushNotice(
          [
            `Project: ${activeProject?.name ?? '(none)'}`,
            `Path: ${activeProject?.path ?? '(default workspace)'}`,
            `Mode: ${activeModeId ?? '—'}`,
            `Model: ${activeModelId ?? '—'}`,
            `Thread: ${transcript.threadId ?? '—'}`,
            `Running: ${transcript.running}`,
          ].join('\n'),
        );
        return;
      case 'abort':
        await abortMutation.mutateAsync();
        return;
      case 'help': {
        const width = Math.max(...SLASH_COMMANDS.map(c => `/${c.name} ${c.args ?? ''}`.length));
        const lines = SLASH_COMMANDS.map(c => {
          const sig = `/${c.name} ${c.args ?? ''}`.padEnd(width);
          return `  ${sig}  — ${c.description}`;
        });
        pushNotice(['Available commands:', ...lines].join('\n'));
        return;
      }
      default:
        pushNotice(`Command /${name} needs arguments. Type it in the composer.`, 'error');
    }
  };

  const run = (command: SlashCommand) => {
    if (command.args) {
      setComposerCommandName(command.name);
      return;
    }

    if (command.name === 'permissions' && permissionsLoading) return;

    void runNoArg(command.name);
  };

  return { run };
}
