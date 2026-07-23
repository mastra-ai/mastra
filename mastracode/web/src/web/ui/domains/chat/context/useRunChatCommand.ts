import type { ToolCategory } from '@mastra/client-js';

import { useParams } from 'react-router';
import {
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
} from '../../../../../shared/hooks/useAgentControllerGoalMutations';
import { useAbortAgentControllerMutation } from '../../../../../shared/hooks/useAgentControllerRunMutations';
import { useFactoryQuery } from '../../../../../shared/hooks/useFactories';
import { SLASH_COMMANDS } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatModes } from './useChatModes';
import { useChatModels } from './useChatModels';
import { useChatPermissions } from './useChatPermissions';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatConnection } from './useChatConnection';
import { useChatRuntime } from './useChatRuntime';
import { useChatTranscript } from './useChatTranscript';

const TOOL_CATEGORIES: ToolCategory[] = ['read', 'edit', 'execute', 'mcp', 'other'];

export function useRunChatCommand() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { busy, pushNotice } = useChatTranscript();
  const { usage, omPhase } = useChatRuntime();
  const { threadId } = useChatConnection();
  const { activeModeId } = useChatModes();
  const { activeModelId } = useChatModels();
  const { permissions, permissionsLoading, setPermissionForCategory } = useChatPermissions();

  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const clearGoalMutation = useClearAgentControllerGoalMutation(hookArgs);
  const pauseGoalMutation = usePauseAgentControllerGoalMutation(hookArgs);
  const resumeGoalMutation = useResumeAgentControllerGoalMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);

  const run = async (name: string) => {
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
        if (permissionsLoading) return;
        const rules = permissions ?? { categories: {}, tools: {} };
        const categories =
          Object.entries(rules.categories ?? {})
            .map(([category, policy]) => `  ${category}: ${policy}`)
            .join('\n') || '  (none)';
        const tools =
          Object.entries(rules.tools ?? {})
            .map(([tool, policy]) => `  ${tool}: ${policy}`)
            .join('\n') || '  (none)';
        pushNotice(`Categories:\n${categories}\nTools:\n${tools}`);
        return;
      }
      case 'yolo':
        for (const category of TOOL_CATEGORIES) {
          await setPermissionForCategory(category, 'allow');
        }
        pushNotice('YOLO mode: all tool categories set to auto-allow');
        return;
      case 'cost': {
        pushNotice(
          !usage?.totalTokens
            ? 'No token usage recorded yet.'
            : `Tokens — prompt: ${usage.promptTokens ?? 0}, completion: ${usage.completionTokens ?? 0}, total: ${usage.totalTokens}`,
        );
        return;
      }
      case 'think':
        pushNotice(
          'Extended thinking: steer the agent with "think step by step" or switch to a thinking-capable model.',
        );
        return;
      case 'om':
        pushNotice(`Observational memory phase: ${omPhase}`);
        return;
      case 'settings':
        pushNotice(
          [
            `Factory: ${factoryQuery.data?.name ?? '(none)'}`,
            `Path: ${projectPath ?? '(no workspace selected)'}`,
            `Mode: ${activeModeId ?? '—'}`,
            `Model: ${activeModelId ?? '—'}`,
            `Thread: ${threadId ?? '—'}`,
            `Running: ${busy}`,
          ].join('\n'),
        );
        return;
      case 'abort':
        await abortMutation.mutateAsync();
        return;
      case 'help': {
        const width = Math.max(...SLASH_COMMANDS.map(command => `/${command.name} ${command.args ?? ''}`.length));
        const lines = SLASH_COMMANDS.map(command => {
          const signature = `/${command.name} ${command.args ?? ''}`.padEnd(width);
          return `  ${signature}  — ${command.description}`;
        });
        pushNotice(['Available commands:', ...lines].join('\n'));
        return;
      }
      default:
        pushNotice(`Command /${name} needs arguments. Type it in the composer.`, 'error');
    }
  };

  return { run };
}
