import type { AgentControllerSessionSettings, ToolCategory } from '@mastra/client-js';
import {
  getAvailableThinkingLevelsForModel,
  parseThinkCommand,
  runThinkingLevel,
  THINK_COMMAND_DESCRIPTOR,
} from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
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
import { useFactoryThinkingDefaultQuery } from '../../../../hooks/use-thinking';
import { useModelReasoningOptions } from '../../../../hooks/useAvailableModels';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import { sessionDefaultsAnchor, settingsSectionPath } from '../../settings/settingsSections';
import type { SlashCommand, SlashCommandOption } from '../services/commands';
import { findCommand, parseSlashCommand } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { FACTORY_THINKING_SOURCE_LABEL, THINKING_LEVEL_LABELS } from '../services/thinkingLevels';
import { useChatModels } from './useChatModels';
import { useChatModelScope } from './useChatModelScope';
import { useChatPermissions } from './useChatPermissions';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatRuntime } from './useChatRuntime';
import { useChatTranscript } from './useChatTranscript';

const TOOL_CATEGORIES: ToolCategory[] = ['read', 'edit', 'execute', 'mcp', 'other'];

function describeFactoryDefault(level: string): string {
  return `${level} (${FACTORY_THINKING_SOURCE_LABEL})`;
}

export function useChatCommandRegistry(prefillComposer: (draft: string) => void) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { transcript, busy, localUser, pushNotice } = useChatTranscript();
  const { usage, omPhase } = useChatRuntime();
  const { activeModelId, setModel } = useChatModels();
  const { catalogTarget, modelScope } = useChatModelScope();
  const activeModelReasoningOptions = useModelReasoningOptions(activeModelId, catalogTarget);
  const availableThinkingLevels = getAvailableThinkingLevelsForModel(activeModelId ?? '', activeModelReasoningOptions);

  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
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
  const factoryThinkingQuery = useFactoryThinkingDefaultQuery(factoryId, { enabled: false });
  const updateSettingsMutation = useUpdateAgentControllerSettingsMutation(hookArgs);
  const { permissions, permissionsLoading, setPermissionForCategory } = useChatPermissions();

  const openSessionDefaults = () => {
    if (factoryId)
      void navigate(settingsSectionPath(factoryId, 'models', sessionDefaultsAnchor(modelScope)), {
        state: { from: location },
      });
  };

  const currentThinkingLevel = settingsQuery.data?.thinkingLevel;
  const runningThinkingLevel =
    currentThinkingLevel && runThinkingLevel(activeModelId ?? '', currentThinkingLevel, activeModelReasoningOptions);
  const thinkingLevelOptions: SlashCommandOption[] = [
    {
      value: 'default',
      label: 'Default',
      description: 'Factory default',
      active: settingsQuery.data !== undefined && currentThinkingLevel === undefined,
    },
    ...availableThinkingLevels.map(level => ({
      value: level,
      label: THINKING_LEVEL_LABELS[level],
      active: runningThinkingLevel === level,
    })),
  ];

  const ensureSettings = async (): Promise<AgentControllerSessionSettings> => {
    if (settingsQuery.data) return settingsQuery.data;
    const result = await settingsQuery.refetch();
    if (!result.data) throw new Error('Session settings are unavailable');
    return result.data;
  };
  const ensureFactoryThinkingDefault = async (): Promise<ThinkingLevelSetting> => {
    if (factoryThinkingQuery.data) return factoryThinkingQuery.data;
    const result = await factoryThinkingQuery.refetch();
    if (!result.data) throw new Error('The Factory thinking level is unavailable');
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
        const action = parseThinkCommand(rawArguments, availableThinkingLevels);
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
              const factoryDefault = await ensureFactoryThinkingDefault();
              pushNotice(`Thinking level set to default: ${describeFactoryDefault(factoryDefault)}.`);
            } catch {
              pushNotice('Thinking level set to default. Current default is unavailable.');
            }
            return;
          }
          const [settings, factoryDefault] = await Promise.all([ensureSettings(), ensureFactoryThinkingDefault()]);
          const defaultLevel = describeFactoryDefault(factoryDefault);
          pushNotice(
            settings.thinkingLevel
              ? `Thinking level: ${settings.thinkingLevel} (session override). Default: ${defaultLevel}.`
              : `Thinking level: ${defaultLevel}.`,
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
      execute: async () => pushNotice(`Observational memory phase: ${omPhase}`),
    },
    {
      name: 'settings',
      description: 'Show session state',
      requiresSession: false,
      execute: async () => {
        pushNotice(
          [
            `Factory: ${factoryQuery.data?.name ?? '(none)'}`,
            `Session: ${sessionId || '—'}`,
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
      execute: async () => openSessionDefaults(),
    },
    {
      name: 'login',
      description: 'Sign in with a provider account',
      requiresSession: false,
      execute: async () => openSessionDefaults(),
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
