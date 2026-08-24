import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import type { AgentControllerSessionSettings } from '@mastra/client-js';

import { queryKeys } from '../../../../api/keys';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import { useClearAgentControllerThinkingLevelMutation } from '../../../../hooks/useClearAgentControllerThinkingLevelMutation';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import type { CommandAvailability, ResolvedChatCommand } from '../services/commands';
import { findCommand, parseCommandInput } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatMessagesInitializing } from './useChatMessagesInitializing';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatTranscript } from './useChatTranscript';
import { usePreparingThreadId } from '../hooks/usePreparingThreadId';
import { useBuiltInChatCommands, type ChatPhase, type SessionSettingsCommandsApi } from './useBuiltInChatCommands';
import { useRuntimeChatCommands } from './useRuntimeChatCommands';

export interface ChatCommandRegistryApi {
  /** Built-ins merged with runtime commands, `/help` included. */
  commands: ResolvedChatCommand[];
  /** Executes slash input. Returns false when the text is not a command. */
  executeText(text: string): Promise<boolean>;
  /** Deduplicated discovery refetch; awaited before an "unknown" verdict. */
  refreshRuntimeCommands(): Promise<unknown>;
}

const SETTINGS_LOADING = 'Session settings are loading';

function firstBlocking(first: CommandAvailability, second: CommandAvailability): CommandAvailability {
  return first.state === 'unavailable' ? first : second;
}

/**
 * Single executable registry for composer slash commands: built-ins plus
 * runtime (server-discovered) commands, with availability, argument
 * completions, and behavior resolved per session phase. Mounted inside
 * `ChatCommandsProvider` so failures can restore the exact draft text.
 */
export function useChatCommandRegistry(setComposerDraft: (draft: string) => void): ChatCommandRegistryApi {
  const queryClient = useQueryClient();
  const session = useChatSessionContext();
  const { resourceId, projectPath, baseUrl, sessionEnabled } = session;
  const { busy, pushNotice } = useChatTranscript();
  const messagesInitializing = useChatMessagesInitializing();
  const preparingThreadId = usePreparingThreadId();

  const phase: ChatPhase =
    !sessionEnabled && !preparingThreadId
      ? 'draft'
      : session.sandboxPreparing || messagesInitializing || Boolean(preparingThreadId)
        ? 'preparing'
        : busy
          ? 'busy'
          : 'ready';

  // Settings hydration backs /yolo and /think — one source of truth for both
  // their visible availability reason and execution after a pending submit.
  const settingsQuery = useAgentControllerSettings({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const updateSettings = useUpdateAgentControllerSettingsMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });
  const clearThinking = useClearAgentControllerThinkingLevelMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });

  const ensureSettings = useCallback(async (): Promise<AgentControllerSessionSettings | undefined> => {
    const key = queryKeys.agentControllerSettings(AGENT_CONTROLLER_ID, resourceId, projectPath);
    const existing = queryClient.getQueryData<AgentControllerSessionSettings>(key);
    if (existing) return existing;
    const result = await settingsQuery.refetch();
    return result.data ?? undefined;
  }, [queryClient, resourceId, projectPath, settingsQuery]);

  const settingsApi: SessionSettingsCommandsApi = {
    availability:
      phase !== 'ready' && phase !== 'busy'
        ? { state: 'available' }
        : settingsQuery.isPending
          ? { state: 'unavailable', reason: SETTINGS_LOADING }
          : { state: 'available' },
    current: settingsQuery.data,
    setYolo: async enabled => {
      await ensureSettings();
      await updateSettings.mutateAsync({ yolo: enabled });
    },
    setThinkingLevel: async level => {
      await ensureSettings();
      await updateSettings.mutateAsync({ thinkingLevel: level });
    },
    clearThinkingLevel: async () => {
      await ensureSettings();
      await clearThinking.mutateAsync();
    },
  };

  const builtInCommands = useBuiltInChatCommands(phase, settingsApi);
  const runtime = useRuntimeChatCommands(phase);
  const refreshRuntimeCommands = useCallback(() => runtime.refreshRuntimeCommands(), [runtime]);

  const withoutHelp: ResolvedChatCommand[] = [
    ...builtInCommands.filter(command => command.id !== 'help'),
    ...runtime.commands,
  ];

  const helpCommand: ResolvedChatCommand = {
    id: 'help',
    invocation: '/help',
    description: 'Show the command list',
    availability: { state: 'available' },
    execute: async () => {
      const resolved = commandsRef.current;
      const width = Math.max(...resolved.map(command => `${command.invocation} ${command.argumentHint ?? ''}`.length));
      const lines = resolved.map(command => {
        const signature = `${command.invocation} ${command.argumentHint ?? ''}`.padEnd(width);
        const suffix = command.availability.state === 'unavailable' ? `  (${command.availability.reason})` : '';
        return `  ${signature}  — ${command.description}${suffix}`;
      });
      pushNotice(['Available commands:', ...lines].join('\n'));
    },
  };

  const commands: ResolvedChatCommand[] = [...withoutHelp, helpCommand];
  // Execution and /help always see the latest resolved registry without
  // rebuilding the callback identity every render.
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const executeText = useCallback(
    async (text: string): Promise<boolean> => {
      const parsed = parseCommandInput(text);
      if (!parsed.command) return false;

      let match = findCommand(commandsRef.current, text);

      if (
        !match &&
        !parsed.command.startsWith('//') &&
        !parsed.command.startsWith('/skill/') &&
        !parsed.command.startsWith('/goal/')
      ) {
        // Unmatched `/name` falls back to a custom `//name`: preparation gets
        // the canonical token while the optimistic row keeps the user's text.
        match = findCommand(commandsRef.current, `//${parsed.command.slice(1)}`);
      }

      // The composer clears its draft before executing; every path that does
      // not run a command gives the user their exact text back.
      const keepDraft = () => setComposerDraft(text);

      if (!match && runtime.isFetching) {
        // A discovery still in flight may know this token — settle before an
        // unknown verdict so loading is never misreported.
        try {
          await refreshRuntimeCommands();
        } catch {
          pushNotice('Commands are unavailable right now.', 'error');
          return true;
        }
      }
      if (!match) match = findCommand(commandsRef.current, text);

      if (!match) {
        const looksRuntimeOnly =
          parsed.command.startsWith('//') ||
          parsed.command.startsWith('/skill/') ||
          parsed.command.startsWith('/goal/');
        keepDraft();
        if (runtime.isError && looksRuntimeOnly) {
          pushNotice('Commands are unavailable right now.', 'error');
          return true;
        }
        pushNotice(`Unknown command: ${parsed.command}`, 'error');
        return true;
      }

      if (match.availability.state === 'unavailable') {
        keepDraft();
        pushNotice(match.availability.reason);
        return true;
      }

      if (match.requiresArguments && !parsed.rawArguments.trim()) {
        keepDraft();
        pushNotice(`Usage: ${match.invocation} ${match.argumentHint ?? '<arguments>'}`);
        return true;
      }

      try {
        await match.execute(parsed.rawArguments, text);
      } catch (error) {
        setComposerDraft(text);
        pushNotice(error instanceof Error ? error.message : 'The command failed.', 'error');
      }
      return true;
    },
    [pushNotice, runtime.isError, runtime.isFetching, refreshRuntimeCommands, setComposerDraft],
  );

  return { commands, executeText, refreshRuntimeCommands };
}
