import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import type { AgentControllerSessionSettings } from '@mastra/client-js';

import { queryKeys } from '../../../../api/keys';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { agentControllerSessionArgs } from '../services/hookArgs';
import { useAgentControllerSettings } from '../../../../hooks/useAgentControllerSettings';
import { useClearAgentControllerThinkingLevelMutation } from '../../../../hooks/useClearAgentControllerThinkingLevelMutation';
import { useUpdateAgentControllerSettingsMutation } from '../../../../hooks/useUpdateAgentControllerSettingsMutation';
import type { CommandAvailability, ResolvedChatCommand } from '../services/commands';
import { isRuntimeStyleToken, parseCommandInput, resolveCommandToken } from '../services/commands';
import { useChatMessagesInitializing } from './useChatMessagesInitializing';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatTranscript } from './useChatTranscript';
import { usePreparingThreadId } from '../hooks/usePreparingThreadId';
import { useBuiltInChatCommands, type ChatPhase, type SessionSettingsCommandsApi } from './useBuiltInChatCommands';
import { useRuntimeChatCommands } from './useRuntimeChatCommands';

export interface ChatCommandRegistryApi {
  /** Built-ins merged with runtime commands, `/help` included. */
  commands: RefCommands;
  /** Executes slash input. Returns false when the text is not a command. */
  executeText(text: string): Promise<boolean>;
  /** Resolves with current discovery descriptors (fresh fetch only if stale). */
  refreshRuntimeCommands(): Promise<unknown>;
}

type RefCommands = ResolvedChatCommand[];

const SETTINGS_LOADING = 'Session settings are loading';
const SETTINGS_ERROR = 'Session settings could not be loaded. Try again in a moment.';

/**
 * Single executable registry for composer slash commands: built-ins plus
 * runtime (server-discovered) commands, with availability, argument
 * completions, and behavior resolved per session phase. Mounted inside
 * `ChatCommandsProvider`, which owns the composer draft.
 */
export function useChatCommandRegistry(
  composerDraft: string,
  setComposerDraft: (draft: string) => void,
): ChatCommandRegistryApi {
  const queryClient = useQueryClient();
  const session = useChatSessionContext();
  const { resourceId, projectPath, sessionEnabled } = session;
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
    ...agentControllerSessionArgs(session),
    enabled: sessionEnabled,
  });
  const updateSettings = useUpdateAgentControllerSettingsMutation(agentControllerSessionArgs(session));
  const clearThinking = useClearAgentControllerThinkingLevelMutation(agentControllerSessionArgs(session));

  const ensureSettings = useCallback(async (): Promise<AgentControllerSessionSettings> => {
    const cached = queryClient.getQueryData<AgentControllerSessionSettings>(
      queryKeys.agentControllerSettings(AGENT_CONTROLLER_ID, resourceId, projectPath),
    );
    if (cached) return cached;
    const result = await settingsQuery.refetch();
    if (!result.data) throw new Error(SETTINGS_ERROR);
    return result.data;
  }, [queryClient, resourceId, projectPath, settingsQuery]);

  const settingsAvailability: CommandAvailability =
    phase !== 'ready' && phase !== 'busy'
      ? { state: 'available' }
      : settingsQuery.isError
        ? { state: 'unavailable', reason: SETTINGS_ERROR }
        : settingsQuery.isPending
          ? { state: 'unavailable', reason: SETTINGS_LOADING }
          : { state: 'available' };

  const settingsApi: SessionSettingsCommandsApi = {
    availability: settingsAvailability,
    // Render-time value backs non-mutating /think status only; every mutation
    // derives its target from the awaited ensure result.
    current: settingsQuery.data,
    setYolo: async () => {
      const current = await ensureSettings();
      await updateSettings.mutateAsync({ yolo: !current.yolo });
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

  const builtInCommands = useBuiltInChatCommands(phase, session.kind, settingsApi);
  const runtime = useRuntimeChatCommands(phase);
  const builtInCommandsRef = useRef(builtInCommands);
  builtInCommandsRef.current = builtInCommands;

  /**
   * Discovery refreshes when a ready/busy draft first turns into a slash
   * command. Level-triggered: a slash typed while preparing stays pending and
   * fires once the session becomes ready; fresh cached results are reused.
   */
  const slashDiscoveryHandledRef = useRef(false);
  useEffect(() => {
    const isSlash = composerDraft.trimStart().startsWith('/');
    const readyish = sessionEnabled && (phase === 'ready' || phase === 'busy');
    if (!isSlash || !readyish || slashDiscoveryHandledRef.current) return;
    slashDiscoveryHandledRef.current = true;
    void runtime.refreshRuntimeCommands();
  }, [composerDraft, phase, sessionEnabled, runtime]);

  const helpCommand: ResolvedChatCommand = {
    id: 'help',
    invocation: '/help',
    description: 'Show the command list',
    availability: { state: 'available' },
    execute: async () => {
      // The first /help on a ready session must include runtime entries even
      // when no discovery had completed before the submit — format from the
      // awaited result, never render-time state.
      const descriptors = await runtime.refreshRuntimeCommands();
      const builtIns = builtInCommandsRef.current.filter(builtIn => builtIn.id !== 'help');
      const runtimeEntries = runtime
        .buildCommands(descriptors)
        .filter(runtimeEntry => !builtIns.some(builtIn => builtIn.invocation === runtimeEntry.invocation));
      const resolved = [...builtIns, ...runtimeEntries, helpCommand];
      const width = Math.max(...resolved.map(entry => `${entry.invocation} ${entry.argumentHint ?? ''}`.length));
      const lines = resolved.map(entry => {
        const signature = `${entry.invocation} ${entry.argumentHint ?? ''}`.padEnd(width);
        const suffix = entry.availability.state === 'unavailable' ? `  (${entry.availability.reason})` : '';
        return `  ${signature}  — ${entry.description}${suffix}`;
      });
      pushNotice(['Available commands:', ...lines].join('\n'));
    },
  };

  const mergedRuntime = runtime.commands.filter(
    runtimeCommand => !builtInCommands.some(builtIn => builtIn.invocation === runtimeCommand.invocation),
  );
  const commands: ResolvedChatCommand[] = [
    ...builtInCommands.filter(builtIn => builtIn.id !== 'help'),
    ...mergedRuntime,
    helpCommand,
  ];
  // Execution always sees the latest resolved list without rebuilding callback
  // identity on every keystroke.
  const commandsRef = useRef<RefCommands>(commands);
  commandsRef.current = commands;

  const executeText = useCallback(
    async (text: string): Promise<boolean> => {
      // Plain prompts are not commands — bail out before any discovery I/O so
      // normal message sends stay untouched.
      if (!parseCommandInput(text).command) return false;

      let resolved = resolveCommandToken(commandsRef.current, text);

      if (!resolved) {
        // A discovery still settling may know this token — await it, rebuild
        // the runtime list FROM THE RESULT, then retry before declaring the
        // input unknown.
        try {
          const descriptors = await runtime.refreshRuntimeCommands();
          resolved = resolveCommandToken([...builtInCommandsRef.current, ...runtime.buildCommands(descriptors)], text);
        } catch {
          setComposerDraft(text);
          pushNotice('Commands are unavailable right now.', 'error');
          return true;
        }
      }

      if (!resolved) {
        const parsedCommand = parseCommandInput(text).command ?? '';
        setComposerDraft(text);
        if (runtime.isError && isRuntimeStyleToken(parsedCommand)) {
          pushNotice('Commands are unavailable right now.', 'error');
          return true;
        }
        pushNotice(`Unknown command: ${parsedCommand}`, 'error');
        return true;
      }

      const { command } = resolved;
      const { rawArguments } = parseCommandInput(text);

      if (command.availability.state === 'unavailable') {
        setComposerDraft(text);
        pushNotice(command.availability.reason);
        return true;
      }

      if (command.requiresArguments && !rawArguments) {
        setComposerDraft(text);
        pushNotice(`Usage: ${command.invocation} ${command.argumentHint ?? '<arguments>'}`);
        return true;
      }

      try {
        await command.execute(rawArguments, text);
      } catch (error) {
        setComposerDraft(text);
        pushNotice(error instanceof Error ? error.message : 'The command failed.', 'error');
      }
      return true;
    },
    [pushNotice, runtime, setComposerDraft],
  );

  return { commands, executeText, refreshRuntimeCommands: runtime.refreshRuntimeCommands };
}
