import type { ToolCategory } from '@mastra/client-js';
import { useLocation, useNavigate, useParams } from 'react-router';

import {
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
  useSetAgentControllerGoalMutation,
} from '../../../../hooks/useAgentControllerGoalMutations';
import { useClearAgentControllerThinkingLevelMutation } from '../../../../hooks/useClearAgentControllerThinkingLevelMutation';
import {
  useAbortAgentControllerMutation,
  useFollowUpAgentControllerMutation,
} from '../../../../hooks/useAgentControllerRunMutations';
import { settingsSectionPath } from '../../settings/settingsSections';
import { formatGoalStatus } from '../services/goal';
import type { ResolvedChatCommand } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { useChatGoal } from './useChatGoal';
import { useChatModes } from './useChatModes';
import { useOverlays } from '../../../lib/overlays';
import { useChatPermissions } from './useChatPermissions';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatTranscript } from './useChatTranscript';

const TOOL_CATEGORIES = ['read', 'edit', 'execute', 'mcp', 'other'] as const;
const PERMISSION_POLICIES = ['allow', 'ask', 'deny'] as const;
const THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
const GOAL_SUBCOMMANDS = ['status', 'pause', 'resume', 'clear'] as const;

const DRAFT_REASON = 'This command needs a session. Send a prompt to create one first.';
const PREPARING_REASON = 'Commands run once the session is ready.';

export type ChatPhase = 'draft' | 'preparing' | 'ready' | 'busy';

export interface SessionSettingsCommandsApi {
  /** Available once the session settings query has hydrated. */
  availability: ResolvedChatCommand['availability'];
  current: import('@mastra/client-js').AgentControllerSessionSettings | undefined;
  setYolo(enabled: boolean): Promise<void>;
  setThinkingLevel(level: (typeof THINKING_LEVELS)[number]): Promise<void>;
  clearThinkingLevel(): Promise<void>;
}

function sessionCommandAvailability(phase: ChatPhase): ResolvedChatCommand['availability'] {
  if (phase === 'ready' || phase === 'busy') return { state: 'available' };
  return { state: 'unavailable', reason: phase === 'draft' ? DRAFT_REASON : PREPARING_REASON };
}

/**
 * Every built-in slash command with its metadata, availability, completions,
 * and behavior in one place. Runtime (server-discovered) commands live in
 * `useRuntimeChatCommands` and are merged by the registry.
 */
export function useBuiltInChatCommands(phase: ChatPhase, settings: SessionSettingsCommandsApi): ResolvedChatCommand[] {
  const { factoryId } = useParams<{ factoryId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const overlays = useOverlays();
  const session = useChatSessionContext();
  const { resourceId, projectPath, baseUrl, sessionEnabled } = session;
  const { transcript, busy, pushNotice, localUser, failLocalUser } = useChatTranscript();
  const { modes, setMode } = useChatModes();
  const { permissions, setPermissionForCategory } = useChatPermissions();
  const { goal } = useChatGoal();

  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const setGoalMutation = useSetAgentControllerGoalMutation(hookArgs);
  const pauseGoalMutation = usePauseAgentControllerGoalMutation(hookArgs);
  const resumeGoalMutation = useResumeAgentControllerGoalMutation(hookArgs);
  const clearGoalMutation = useClearAgentControllerGoalMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);
  const followUpMutation = useFollowUpAgentControllerMutation(hookArgs);
  const clearThinkingMutation = useClearAgentControllerThinkingLevelMutation(hookArgs);

  const navigateToSettings = (section: 'memory' | 'behavior' | 'models') => {
    if (!factoryId) return;
    void navigate(settingsSectionPath(factoryId, section), { state: { from: location } });
  };

  const runGoalSubcommand = async (subcommand: (typeof GOAL_SUBCOMMANDS)[number]): Promise<void> => {
    switch (subcommand) {
      case 'status':
        pushNotice(formatGoalStatus(goal));
        return;
      case 'pause':
        if (!goal || goal.status === 'done') {
          pushNotice('No goal to pause.');
          return;
        }
        if (goal.status === 'paused') {
          pushNotice('Goal is already paused.');
          return;
        }
        await pauseGoalMutation.mutateAsync();
        return;
      case 'resume':
        if (!goal || goal.status === 'done') {
          pushNotice('No goal to resume. Use /goal <objective> to set one.');
          return;
        }
        if (goal.status === 'active') {
          pushNotice('Goal is already active.');
          return;
        }
        await resumeGoalMutation.mutateAsync();
        return;
      case 'clear':
        await clearGoalMutation.mutateAsync();
        // A cleared goal must not keep driving the loop it was mid-run in.
        if (busy) await abortMutation.mutateAsync();
        return;
    }
  };

  const commands: ResolvedChatCommand[] = [
    {
      id: 'models',
      invocation: '/models',
      description: 'Switch model',
      availability:
        phase === 'preparing'
          ? { state: 'unavailable', reason: 'Wait for the workspace to finish preparing.' }
          : { state: 'available' },
      execute: async () => {
        overlays.open('models');
      },
    },
    {
      id: 'mode',
      invocation: '/mode',
      argumentHint: '<id>',
      completeArguments: modes.map(mode => mode.id),
      description: 'Switch mode',
      availability:
        phase === 'preparing'
          ? { state: 'unavailable', reason: 'Wait for the workspace to finish preparing.' }
          : modes.length <= 1
            ? { state: 'unavailable', reason: 'Only one mode is available for this session.' }
            : { state: 'available' },
      requiresArguments: true,
      execute: async rawArguments => {
        const modeId = rawArguments.trim().split(/\s+/)[0]!;
        const target = modes.find(mode => mode.id === modeId);
        if (!target) {
          throw new Error(`Unknown mode "${modeId}". Available modes: ${modes.map(mode => mode.id).join(', ')}`);
        }
        await setMode(target.id);
      },
    },
    {
      id: 'goal',
      invocation: '/goal',
      argumentHint: '<objective|status|pause|resume|clear>',
      completeArguments: [...GOAL_SUBCOMMANDS],
      description: 'Set or manage a goal',
      availability: sessionCommandAvailability(phase),
      execute: async rawArguments => {
        const trimmed = rawArguments.trim();
        const [firstWord] = trimmed.split(/\s+/);
        if (!trimmed) {
          pushNotice(formatGoalStatus(goal));
          return;
        }
        if ((GOAL_SUBCOMMANDS as readonly string[]).includes(trimmed)) {
          await runGoalSubcommand(firstWord as (typeof GOAL_SUBCOMMANDS)[number]);
          return;
        }
        // The whole argument string is the objective — never collapsed.
        await setGoalMutation.mutateAsync({ objective: trimmed, trigger: true });
      },
    },
    {
      id: 'permissions',
      invocation: '/permissions',
      argumentHint: '[set <read|edit|execute|mcp|other> <allow|ask|deny>]',
      completeArguments: ['set'],
      description: 'Show or set permission rules',
      availability: sessionCommandAvailability(phase),
      execute: async rawArguments => {
        const parts = rawArguments.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0 || parts[0] !== 'set') {
          const rules = permissions ?? { categories: {}, tools: {} };
          const cats =
            Object.entries(rules.categories ?? {})
              .map(([k, v]) => `  ${k}: ${v}`)
              .join('\n') || '  (none)';
          const tools =
            Object.entries(rules.tools ?? {})
              .map(([k, v]) => `  ${k}: ${v}`)
              .join('\n') || '  (none)';
          pushNotice(`Categories:\n${cats}\nTools:\n${tools}\n\nUsage: /permissions set <category> <policy>`);
          return;
        }
        if (parts.length !== 3) {
          throw new Error('/permissions set <read|edit|execute|mcp|other> <allow|ask|deny>');
        }
        const category = parts[1]!;
        const policy = parts[2]!;
        if (!(TOOL_CATEGORIES as readonly string[]).includes(category)) {
          throw new Error(`Unknown category "${category}". Categories: ${TOOL_CATEGORIES.join(', ')}`);
        }
        if (!(PERMISSION_POLICIES as readonly string[]).includes(policy)) {
          throw new Error(`Unknown policy "${policy}". Policies: ${PERMISSION_POLICIES.join(', ')}`);
        }
        await setPermissionForCategory(category as ToolCategory, policy as (typeof PERMISSION_POLICIES)[number]);
      },
    },
    {
      id: 'yolo',
      invocation: '/yolo',
      description: 'Toggle auto-allow for all tool categories',
      availability:
        settings.availability.state === 'unavailable' ? settings.availability : sessionCommandAvailability(phase),
      execute: async () => {
        await settings.setYolo(!settings.current?.yolo);
      },
    },
    {
      id: 'cost',
      invocation: '/cost',
      description: 'Show token usage',
      availability: { state: 'available' },
      execute: async () => {
        const u = transcript.usage;
        pushNotice(
          !u?.totalTokens
            ? 'No token usage recorded yet.'
            : `Tokens — prompt: ${u.promptTokens ?? 0}, completion: ${u.completionTokens ?? 0}, total: ${u.totalTokens}`,
        );
      },
    },
    {
      id: 'think',
      invocation: '/think',
      argumentHint: '[status|default|clear|off|low|medium|high|xhigh|max]',
      completeArguments: ['status', 'default', 'clear', ...THINKING_LEVELS],
      description: 'Show or change thinking level',
      availability:
        settings.availability.state === 'unavailable' ? settings.availability : sessionCommandAvailability(phase),
      execute: async rawArguments => {
        const arg = rawArguments.trim().toLowerCase() || 'status';
        if (arg === 'status') {
          pushNotice(
            settings.current?.thinkingLevel
              ? `Thinking level: ${settings.current.thinkingLevel}`
              : 'Thinking level: default (no override)',
          );
          return;
        }
        if (arg === 'default' || arg === 'clear') {
          await settings.clearThinkingLevel();
          pushNotice('Thinking level override cleared.');
          return;
        }
        if (!(THINKING_LEVELS as readonly string[]).includes(arg)) {
          throw new Error(`/think [status|default|clear|${THINKING_LEVELS.join('|')}]`);
        }
        await settings.setThinkingLevel(arg as (typeof THINKING_LEVELS)[number]);
        pushNotice(`Thinking level set to ${arg}.`);
      },
    },
    {
      id: 'memory',
      invocation: '/memory',
      description: 'Open memory settings',
      availability: { state: 'available' },
      execute: async () => navigateToSettings('memory'),
    },
    {
      id: 'om',
      invocation: '/om',
      description: 'Open observational memory settings',
      availability: { state: 'available' },
      execute: async () => navigateToSettings('memory'),
    },
    {
      id: 'settings',
      invocation: '/settings',
      description: 'Open behavior settings',
      availability: { state: 'available' },
      execute: async () => navigateToSettings('behavior'),
    },
    {
      id: 'login',
      invocation: '/login',
      description: 'Connect a model provider',
      availability: { state: 'available' },
      execute: async () => navigateToSettings('models'),
    },
    {
      id: 'follow-up',
      invocation: '/follow-up',
      argumentHint: '<message>',
      description: 'Queue a follow-up message',
      availability: sessionCommandAvailability(phase),
      requiresArguments: true,
      execute: async rawArguments => {
        const localId = localUser(rawArguments.trim(), true);
        try {
          await followUpMutation.mutateAsync(rawArguments.trim());
        } catch (error) {
          failLocalUser(localId);
          throw error;
        }
      },
    },
    {
      id: 'abort',
      invocation: '/abort',
      description: 'Abort the current run',
      availability:
        phase === 'busy' ? { state: 'available' } : { state: 'unavailable', reason: 'Nothing is running right now.' },
      execute: async () => {
        await abortMutation.mutateAsync();
      },
    },
    {
      id: 'help',
      invocation: '/help',
      description: 'Show the command list',
      availability: { state: 'available' },
      execute: async () => {},
    },
  ];

  return commands;
}
