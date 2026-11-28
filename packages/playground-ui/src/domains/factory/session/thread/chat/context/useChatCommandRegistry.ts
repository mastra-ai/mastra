import type { ToolCategory } from '@mastra/client-js';
import {
  getAvailableThinkingLevelsForModel,
  parseThinkCommand,
  runThinkingLevel,
  THINK_COMMAND_DESCRIPTOR,
} from '@mastra/core/llm/reasoning';
import { useModelReasoningOptions } from '@mastra/react/hooks/factory';

import type { SlashCommand, SlashCommandOption } from '../services/commands';
import { findCommand, isSlashCommand, parseSlashCommand } from '../services/commands';
import { sessionDefaultsAnchor } from '../services/sessionSettings';
import { DEFAULT_SOURCE_LABELS, THINKING_LEVEL_LABELS } from '../services/thinkingLevels';
import type { ThinkingDefault } from '../services/thinkingLevels';
import { useSessionHost } from './SessionHostContext';
import { useChatModels } from './useChatModels';
import { useChatModelScope } from './useChatModelScope';
import { useOptionalChatPermissions } from './useChatPermissions';
import { useChatRuntime } from './useChatRuntime';
import { useChatSessionActions } from './useChatSessionActions';
import { useChatSessionContext } from './useChatSessionContext';
import { useOptionalChatThinking } from './useChatThinking';
import { useChatTranscript } from './useChatTranscript';

const TOOL_CATEGORIES: ToolCategory[] = ['read', 'edit', 'execute', 'mcp', 'other'];

function describeThinkingDefault({ level, origin }: ThinkingDefault): string {
  return `${level} (${DEFAULT_SOURCE_LABELS[origin]})`;
}

export function useChatCommandRegistry(prefillComposer: (draft: string) => void) {
  const { factoryProjectId: factoryId, navigate, links } = useSessionHost();
  const factoryQuery = useSessionHost().data.useProject(factoryId);
  const { sessionId, modelLockedReason } = useChatSessionContext();
  const { transcript, busy, localUser, pushNotice } = useChatTranscript();
  const { usage, omPhase } = useChatRuntime();
  const { activeModelId, select } = useChatModels();
  const { catalogTarget, modelScope } = useChatModelScope();
  const activeModelReasoningOptions = useModelReasoningOptions(activeModelId, catalogTarget);
  const availableThinkingLevels = getAvailableThinkingLevelsForModel(activeModelId ?? '', activeModelReasoningOptions);

  const actions = useChatSessionActions();
  const { goal, followUp } = actions;
  const permissions = useOptionalChatPermissions();
  const thinking = useOptionalChatThinking();
  const thinkingDefault = thinking?.thinkingDefault;

  const openSessionDefaults = () => {
    if (factoryId) navigate(links.settings('models', sessionDefaultsAnchor(modelScope)), { returnHere: true });
  };

  const currentThinkingLevel = thinking?.sessionLevel.level;
  const runningThinkingLevel =
    currentThinkingLevel && runThinkingLevel(activeModelId ?? '', currentThinkingLevel, activeModelReasoningOptions);
  const thinkingLevelOptions: SlashCommandOption[] = [
    {
      value: 'default',
      label: 'Default',
      ...(thinkingDefault ? { description: DEFAULT_SOURCE_LABELS[thinkingDefault.origin] } : {}),
      active: Boolean(thinking?.sessionLevel.loaded) && currentThinkingLevel === undefined,
    },
    ...availableThinkingLevels.map(level => ({
      value: level,
      label: THINKING_LEVEL_LABELS[level],
      active: runningThinkingLevel === level,
    })),
  ];

  const commandsWithoutHelp: SlashCommand[] = [
    ...(select
      ? ([
          {
            name: 'model',
            args: '<id>',
            description: 'Switch model',
            requiresSession: true,
            execute: async rawArguments => {
              if (!rawArguments) return;
              if (modelLockedReason) return pushNotice(modelLockedReason);
              await select({ kind: 'model', modelId: rawArguments });
            },
          },
        ] satisfies SlashCommand[])
      : []),
    ...(goal
      ? ([
          {
            name: 'goal',
            args: '<objective>',
            description: 'Set a goal',
            requiresSession: true,
            execute: async rawArguments => {
              if (rawArguments) await goal.set(rawArguments);
            },
          },
          {
            name: 'goal-clear',
            description: 'Clear the active goal',
            requiresSession: true,
            execute: async () => {
              await goal.clear();
            },
          },
          {
            name: 'goal-pause',
            description: 'Pause the active goal',
            requiresSession: true,
            execute: async () => {
              await goal.pause();
            },
          },
          {
            name: 'goal-resume',
            description: 'Resume the paused goal',
            requiresSession: true,
            execute: async () => {
              await goal.resume();
            },
          },
        ] satisfies SlashCommand[])
      : []),
    ...(permissions
      ? ([
          {
            name: 'permissions',
            description: 'Show permission rules',
            requiresSession: true,
            execute: async () => {
              if (permissions.permissionsLoading) return;
              const rules = permissions.permissions ?? { categories: {}, tools: {} };
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
                await permissions.setPermissionForCategory(category, 'allow');
              }
              pushNotice('YOLO mode: all tool categories set to auto-allow');
            },
          },
        ] satisfies SlashCommand[])
      : []),
    {
      name: 'cost',
      description: 'Show token usage',
      requiresSession: false,
      execute: async () => {
        pushNotice(
          !usage?.totalTokens
            ? 'No token usage recorded yet.'
            : `Used ${usage.totalTokens} tokens (${usage.promptTokens ?? 0} prompt, ${usage.completionTokens ?? 0} completion).`,
        );
      },
    },
    ...(thinking
      ? ([
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
                const changesThinkingLevel = action.kind === 'set' || action.kind === 'clear';
                if (modelLockedReason && changesThinkingLevel) return pushNotice(modelLockedReason);
                if (action.kind === 'set') {
                  await thinking.sessionLevel.load();
                  await thinking.setLevel(action.level);
                  pushNotice(`Thinking level set to ${action.level}.`);
                  return;
                }
                if (action.kind === 'clear') {
                  await thinking.sessionLevel.load();
                  await thinking.resetLevel();
                  pushNotice(
                    thinkingDefault
                      ? `Thinking level set to default: ${describeThinkingDefault(thinkingDefault)}.`
                      : 'Thinking level set to default. Current default is unavailable.',
                  );
                  return;
                }
                const sessionThinkingLevel = await thinking.sessionLevel.load();
                if (!thinkingDefault) throw new Error('The thinking default is unavailable');
                const defaultLevel = describeThinkingDefault(thinkingDefault);
                pushNotice(
                  sessionThinkingLevel
                    ? `Thinking level: ${sessionThinkingLevel} (session override). Default: ${defaultLevel}.`
                    : `Thinking level: ${defaultLevel}.`,
                );
              } catch (error) {
                prefillComposer(originalText);
                throw error;
              }
            },
          },
        ] satisfies SlashCommand[])
      : []),
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
    ...(followUp
      ? ([
          {
            name: 'follow-up',
            args: '<message>',
            description: 'Queue a follow-up message',
            requiresSession: true,
            execute: async rawArguments => {
              if (rawArguments) {
                localUser(rawArguments);
                await followUp(rawArguments);
              }
            },
          },
        ] satisfies SlashCommand[])
      : []),
    {
      name: 'abort',
      description: 'Abort the current run',
      requiresSession: true,
      execute: async () => {
        await actions.abort();
      },
    },
  ];

  const helpCommand: SlashCommand = {
    name: 'help',
    description: 'Show the command list',
    requiresSession: false,
    execute: async () => {
      const commands = [...commandsWithoutHelp, helpCommand];
      const lines = commands.map(command => {
        return `/${command.name}${command.args ? ` ${command.args}` : ''}: ${command.description}`;
      });
      pushNotice(['Available commands:', ...lines].join('\n'));
    },
  };

  const commands = [...commandsWithoutHelp, helpCommand];

  const runComposerCommand = async (text: string): Promise<boolean> => {
    if (!isSlashCommand(text)) return false;
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
