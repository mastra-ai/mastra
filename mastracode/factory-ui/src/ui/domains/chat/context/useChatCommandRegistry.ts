import type { AgentControllerSessionSettings, ToolCategory } from '@mastra/client-js';
import { useLocation, useNavigate, useParams } from 'react-router';

import {
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
  useSetAgentControllerGoalMutation,
} from '../../../../hooks/useAgentControllerGoalMutations';
import {
  useAbortAgentControllerMutation,
  useFollowUpAgentControllerMutation,
} from '../../../../hooks/useAgentControllerRunMutations';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { settingsSectionPath } from '../../settings/settingsSections';
import type { SlashCommand } from '../services/commands';
import { findCommand, parseSlashCommand } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatModels } from './useChatModels';
import { useChatModes } from './useChatModes';
import { useChatPermissions } from './useChatPermissions';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatTranscript } from './useChatTranscript';

const TOOL_CATEGORIES: ToolCategory[] = ['read', 'edit', 'execute', 'mcp', 'other'];
type ThinkingLevel = NonNullable<AgentControllerSessionSettings['thinkingLevel']>;
const THINKING_LEVELS: ThinkingLevel[] = ['off', 'low', 'medium', 'high', 'xhigh', 'max'];

function isThinkingLevel(value: string): value is ThinkingLevel {
  return THINKING_LEVELS.some(level => level === value);
}

export function useChatCommandRegistry(prefillComposer: (draft: string) => void) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const navigate = useNavigate();
  const location = useLocation();
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { transcript, busy, localUser, pushNotice } = useChatTranscript();
  const { activeModeId } = useChatModes();
  const { activeModelId, setModel } = useChatModels();

  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const clearGoalMutation = useClearAgentControllerGoalMutation(hookArgs);
  const pauseGoalMutation = usePauseAgentControllerGoalMutation(hookArgs);
  const resumeGoalMutation = useResumeAgentControllerGoalMutation(hookArgs);
  const setGoalMutation = useSetAgentControllerGoalMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);
  const followUpMutation = useFollowUpAgentControllerMutation(hookArgs);
  const settingsQuery = useAgentControllerSettings(hookArgs);
  const updateSettingsMutation = useUpdateAgentControllerSettingsMutation(hookArgs);
  const { permissions, permissionsLoading, setPermissionForCategory } = useChatPermissions();

  const ensureSettings = async (): Promise<AgentControllerSessionSettings> => {
    if (settingsQuery.data) return settingsQuery.data;
    const result = await settingsQuery.refetch();
    if (!result.data) throw new Error('Session settings are unavailable');
    return result.data;
  };

  const commandsWithoutHelp: SlashCommand[] = [
    {
      name: 'model',
      args: '<id>',
      description: 'Switch model',
      requiresSession: true,
      execute: async rawArguments => {
        if (rawArguments) await setModel(rawArguments);
      },
    },
    {
      name: 'goal',
      args: '<objective>',
      description: 'Set a goal',
      requiresSession: true,
      execute: async rawArguments => {
        if (rawArguments) await setGoalMutation.mutateAsync(rawArguments);
      },
    },
    {
      name: 'goal-clear',
      description: 'Clear the active goal',
      requiresSession: true,
      execute: async () => {
        await clearGoalMutation.mutateAsync();
      },
    },
    {
      name: 'goal-pause',
      description: 'Pause the active goal',
      requiresSession: true,
      execute: async () => {
        await pauseGoalMutation.mutateAsync();
      },
    },
    {
      name: 'goal-resume',
      description: 'Resume the paused goal',
      requiresSession: true,
      execute: async () => {
        await resumeGoalMutation.mutateAsync();
      },
    },
    {
      name: 'permissions',
      description: 'Show permission rules',
      requiresSession: true,
      execute: async () => {
        if (permissionsLoading) return;
        const rules = permissions ?? { categories: {}, tools: {} };
        const categories =
          Object.entries(rules.categories ?? {})
            .map(([key, value]) => `  ${key}: ${value}`)
            .join('\n') || '  (none)';
        const tools =
          Object.entries(rules.tools ?? {})
            .map(([key, value]) => `  ${key}: ${value}`)
            .join('\n') || '  (none)';
        pushNotice(`Categories:\n${categories}\nTools:\n${tools}`);
      },
    },
    {
      name: 'yolo',
      description: 'Auto-allow all tool categories',
      requiresSession: true,
      execute: async () => {
        for (const category of TOOL_CATEGORIES) {
          await setPermissionForCategory(category, 'allow');
        }
        pushNotice('YOLO mode: all tool categories set to auto-allow');
      },
    },
    {
      name: 'cost',
      description: 'Show token usage',
      requiresSession: false,
      execute: async () => {
        const usage = transcript.usage;
        pushNotice(
          !usage?.totalTokens
            ? 'No token usage recorded yet.'
            : `Tokens — prompt: ${usage.promptTokens ?? 0}, completion: ${usage.completionTokens ?? 0}, total: ${usage.totalTokens}`,
        );
      },
    },
    {
      name: 'think',
      args: '[status|off|low|medium|high|xhigh|max]',
      description: 'Show or set session thinking level',
      requiresSession: true,
      execute: async (rawArguments, originalText) => {
        const value = rawArguments.trim().toLowerCase() || 'status';
        try {
          const settings = await ensureSettings();
          if (value === 'status') {
            pushNotice(
              settings.thinkingLevel
                ? `Thinking level: ${settings.thinkingLevel}`
                : 'Thinking level: default (no session override)',
            );
            return;
          }
          if (!isThinkingLevel(value)) {
            prefillComposer(originalText);
            pushNotice(`Unknown thinking level: ${value}. Use: ${THINKING_LEVELS.join(', ')}`, 'error');
            return;
          }
          await updateSettingsMutation.mutateAsync({ thinkingLevel: value });
          pushNotice(`Thinking level set to ${value}.`);
        } catch (error) {
          prefillComposer(originalText);
          throw error;
        }
      },
    },
    {
      name: 'om',
      description: 'Show observational-memory phase',
      requiresSession: false,
      execute: async () => pushNotice(`Observational memory phase: ${transcript.omPhase ?? 'idle'}`),
    },
    {
      name: 'settings',
      description: 'Show session state',
      requiresSession: false,
      execute: async () => {
        pushNotice(
          [
            `Factory: ${factoryQuery.data?.name ?? '(none)'}`,
            `Path: ${projectPath ?? '(no workspace selected)'}`,
            `Mode: ${activeModeId ?? '—'}`,
            `Model: ${activeModelId ?? '—'}`,
            `Thread: ${transcript.threadId ?? '—'}`,
            `Running: ${busy}`,
          ].join('\n'),
        );
      },
    },
    {
      name: 'login',
      description: 'Connect a model provider',
      requiresSession: false,
      execute: async () => {
        if (factoryId) void navigate(settingsSectionPath(factoryId, 'models'), { state: { from: location } });
      },
    },
    {
      name: 'follow-up',
      args: '<message>',
      description: 'Queue a follow-up message',
      requiresSession: true,
      execute: async rawArguments => {
        if (rawArguments) {
          localUser(rawArguments);
          await followUpMutation.mutateAsync(rawArguments);
        }
      },
    },
    {
      name: 'abort',
      description: 'Abort the current run',
      requiresSession: true,
      execute: async () => {
        await abortMutation.mutateAsync();
      },
    },
  ];

  const helpCommand: SlashCommand = {
    name: 'help',
    description: 'Show the command list',
    requiresSession: false,
    execute: async () => {
      const commands = [...commandsWithoutHelp, helpCommand];
      const width = Math.max(...commands.map(command => `/${command.name} ${command.args ?? ''}`.length));
      const lines = commands.map(command => {
        const signature = `/${command.name} ${command.args ?? ''}`.padEnd(width);
        return `  ${signature}  — ${command.description}`;
      });
      pushNotice(['Available commands:', ...lines].join('\n'));
    },
  };

  const commands = [...commandsWithoutHelp, helpCommand];

  const runComposerCommand = async (text: string): Promise<boolean> => {
    if (!text.startsWith('/')) return false;
    const command = findCommand(commands, text);
    const parsed = parseSlashCommand(text);
    if (!command) {
      prefillComposer(text);
      pushNotice(`Unknown command: /${parsed.name ?? ''}`, 'error');
      return true;
    }
    await command.execute(parsed.rawArguments, text);
    return true;
  };

  return { commands, runComposerCommand };
}
