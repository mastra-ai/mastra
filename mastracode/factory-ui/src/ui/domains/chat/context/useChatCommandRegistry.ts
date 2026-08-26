import type { AgentControllerSessionSettings, ToolCategory } from '@mastra/client-js';
import {
  getAvailableThinkingLevelsForModel,
  parseThinkCommand,
  resolveDefaultThinkingLevel,
  THINK_COMMAND_DESCRIPTOR,
} from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting, ThinkingLevelSource } from '@mastra/code-sdk/thinking';
import { useLocation, useNavigate, useParams } from 'react-router';
import type { ThinkingConfigInfo } from '../../../../api/types';

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
import { useThinkingConfigQuery } from '../../../../hooks/use-thinking';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { settingsSectionPath } from '../../settings/settingsSections';
import type { SlashCommand, SlashCommandOption } from '../services/commands';
import { findCommand, parseSlashCommand } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatModels } from './useChatModels';
import { useChatModes } from './useChatModes';
import { useChatPermissions } from './useChatPermissions';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatTranscript } from './useChatTranscript';

const TOOL_CATEGORIES: ToolCategory[] = ['read', 'edit', 'execute', 'mcp', 'other'];
const THINKING_LEVEL_LABELS: Record<ThinkingLevelSetting, string> = {
  off: 'Off',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
};
function thinkingSourceLabel(source: ThinkingLevelSource, modeId: string | null): string {
  return source === 'mode-default' && modeId ? `${modeId} mode default` : 'global default';
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
  const thinkingConfigQuery = useThinkingConfigQuery({ enabled: false });
  const updateSettingsMutation = useUpdateAgentControllerSettingsMutation(hookArgs);
  const { permissions, permissionsLoading, setPermissionForCategory } = useChatPermissions();

  const currentThinkingLevel = settingsQuery.data?.thinkingLevel;
  const thinkingLevelOptions: SlashCommandOption[] = [
    {
      value: 'default',
      label: 'Default',
      description: 'Mode or global default',
      active: settingsQuery.data !== undefined && currentThinkingLevel === undefined,
    },
    ...getAvailableThinkingLevelsForModel(activeModelId ?? '').map(level => ({
      value: level,
      label: THINKING_LEVEL_LABELS[level],
      active: currentThinkingLevel === level,
    })),
  ];

  const ensureSettings = async (): Promise<AgentControllerSessionSettings> => {
    if (settingsQuery.data) return settingsQuery.data;
    const result = await settingsQuery.refetch();
    if (!result.data) throw new Error('Session settings are unavailable');
    return result.data;
  };
  const ensureThinkingConfig = async (): Promise<ThinkingConfigInfo> => {
    if (thinkingConfigQuery.data) return thinkingConfigQuery.data;
    const result = await thinkingConfigQuery.refetch();
    if (!result.data) throw new Error('Thinking defaults are unavailable');
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
      ...THINK_COMMAND_DESCRIPTOR,
      requiresSession: true,
      options: thinkingLevelOptions,
      execute: async (rawArguments, originalText) => {
        const levels = getAvailableThinkingLevelsForModel(activeModelId ?? '');
        const action = parseThinkCommand(rawArguments, levels);
        try {
          if (action.kind === 'invalid') {
            prefillComposer(originalText);
            pushNotice(
              `Unknown thinking level: ${action.value}. Use: ${action.levels.join(', ')}, default, status`,
              'error',
            );
            return;
          }
          if (action.kind === 'set') {
            await ensureSettings();
            await updateSettingsMutation.mutateAsync({ thinkingLevel: action.level });
            pushNotice(`Thinking level set to ${action.level}.`);
            return;
          }
          if (action.kind === 'clear') {
            await ensureSettings();
            await updateSettingsMutation.mutateAsync({ thinkingLevel: null });
            try {
              const defaults = await ensureThinkingConfig();
              const modeId = activeModeId ?? null;
              const fallback = resolveDefaultThinkingLevel(defaults, modeId);
              const source = thinkingSourceLabel(fallback.source, modeId);
              pushNotice(`Thinking level set to default: ${fallback.level} (${source}).`);
            } catch {
              pushNotice('Thinking level set to default. Current default is unavailable.');
            }
            return;
          }
          const [settings, defaults] = await Promise.all([ensureSettings(), ensureThinkingConfig()]);
          const modeId = activeModeId ?? null;
          const fallback = resolveDefaultThinkingLevel(defaults, modeId);
          const source = thinkingSourceLabel(fallback.source, modeId);
          pushNotice(
            settings.thinkingLevel
              ? `Thinking level: ${settings.thinkingLevel} (session override). Default: ${fallback.level} (${source}).`
              : `Thinking level: ${fallback.level} (${source}).`,
          );
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
      name: 'connect',
      description: 'Connect a model provider',
      requiresSession: false,
      execute: async () => {
        if (factoryId) void navigate(settingsSectionPath(factoryId, 'models'), { state: { from: location } });
      },
    },
    {
      name: 'login',
      description: 'Sign in with a provider account',
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
