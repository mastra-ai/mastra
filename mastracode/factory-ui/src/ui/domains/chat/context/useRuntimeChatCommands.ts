import { prepareSessionCommandViaFetch, useSessionCommandsQuery } from '../services/sessionCommands';
import type { ResolvedChatCommand } from '../services/commands';
import { agentControllerSessionArgs } from '../services/hookArgs';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import type { ChatPhase } from './useBuiltInChatCommands';
import type { SessionCommandDescriptor } from '@mastra/factory/routes/session-command-contract';
import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { useSetAgentControllerGoalMutation } from '../../../../hooks/useAgentControllerGoalMutations';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatTranscript } from './useChatTranscript';

const DRAFT_REASON = 'This command needs a session. Send a prompt to create one first.';
const PREPARING_REASON = 'Commands run once the session is ready.';

export function runtimeAvailabilityFor(phase: ChatPhase): ResolvedChatCommand['availability'] {
  if (phase === 'ready' || phase === 'busy') return { state: 'available' };
  return { state: 'unavailable', reason: phase === 'draft' ? DRAFT_REASON : PREPARING_REASON };
}

interface PrepareSubmitDeps {
  address: Parameters<typeof prepareSessionCommandViaFetch>[0];
  busy: boolean;
  localUser: ReturnType<typeof useChatTranscript>['localUser'];
  failLocalUser: ReturnType<typeof useChatTranscript>['failLocalUser'];
  send: (text: string) => Promise<unknown>;
  setTriggeredGoal: (objective: string) => Promise<unknown>;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
}

/**
 * Pure conversion of discovery descriptors into executable commands. Exported
 * so the registry can rebuild the list from freshly awaited discovery results
 * instead of reading render-time state.
 */
export function buildRuntimeCommands(
  descriptors: readonly SessionCommandDescriptor[],
  availability: ResolvedChatCommand['availability'],
  deps: PrepareSubmitDeps,
): ResolvedChatCommand[] {
  const commands = descriptors.map<ResolvedChatCommand>(descriptor => ({
    id: `runtime:${descriptor.command}`,
    invocation: descriptor.command,
    description: descriptor.description || 'Custom command',
    availability,
    execute: async (rawArguments: string, originalText: string) => {
      try {
        await prepareAndSubmit(deps, descriptor.command, rawArguments, originalText);
      } catch (error) {
        throw error instanceof Error ? error : new Error('The command could not be prepared.');
      }
    },
  }));

  const skillsCommand: ResolvedChatCommand = {
    id: 'skills',
    invocation: '/skills',
    description: 'List available skills',
    availability,
    execute: async () => {
      const skillNames = descriptors
        .filter(descriptor => descriptor.source === 'skill')
        .map(descriptor => descriptor.name);
      deps.pushNotice(
        skillNames.length
          ? `Skills:\n${skillNames.map(name => `  ${name}`).join('\n')}`
          : 'No invocable skills discovered.',
      );
    },
  };

  return [...commands, skillsCommand];
}

async function prepareAndSubmit(
  deps: PrepareSubmitDeps,
  invocation: string,
  rawArguments: string,
  originalText: string,
): Promise<void> {
  const outcome = await prepareSessionCommandViaFetch(deps.address, {
    command: invocation,
    ...(rawArguments ? { arguments: rawArguments } : {}),
  });
  if (outcome.action === 'message') {
    // The optimistic row shows what the user typed; the model receives the
    // server-expanded envelope instead of the raw slash text.
    const localId = deps.localUser(originalText, deps.busy);
    try {
      await deps.send(outcome.content);
    } catch (error) {
      deps.failLocalUser(localId);
      throw error;
    }
    return;
  }
  if (outcome.action === 'goal') {
    await deps.setTriggeredGoal(outcome.objective);
    return;
  }
  deps.pushNotice(outcome.notice);
}

/**
 * Server-discovered custom commands and skills as executable commands. Every
 * execution re-prepares server-side (fresh expansion) before the result is
 * submitted, so a stale suggestion can never send stale content.
 */
export function useRuntimeChatCommands(phase: ChatPhase) {
  const session = useChatSessionContext();
  const { resourceId, projectPath, baseUrl, sessionEnabled, factorySessionState } = session;
  const projectRepositoryId = factorySessionState?.projectRepositoryId;
  const { busy, pushNotice, localUser, failLocalUser } = useChatTranscript();

  const address = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectRepositoryId,
    scope: projectPath,
    baseUrl,
  };
  const discovery = useSessionCommandsQuery(address);

  const mutationArgs = agentControllerSessionArgs(session);
  const sendMutation = useSendAgentControllerMessageMutation(mutationArgs);
  const setGoalMutation = useSetAgentControllerGoalMutation(mutationArgs);

  const deps: PrepareSubmitDeps = {
    address,
    busy,
    localUser,
    failLocalUser,
    send: text => sendMutation.mutateAsync({ text }),
    setTriggeredGoal: objective => setGoalMutation.mutateAsync({ objective, trigger: true }),
    pushNotice,
  };

  const availability = runtimeAvailabilityFor(phase);
  const commands = buildRuntimeCommands(discovery.data?.commands ?? [], availability, deps);

  /**
   * Refetch only when there is no fresh cached discovery (React Query's
   * staleTime governs), and resolve with the resulting descriptors so callers
   * rebuild commands from the answer itself.
   */
  const refreshRuntimeCommands = async (): Promise<SessionCommandDescriptor[]> => {
    if (discovery.isSuccess && !discovery.isStale && discovery.data) {
      return discovery.data.commands;
    }
    const result = await discovery.refetch();
    return result.data?.commands ?? [];
  };

  return {
    commands,
    /** Rebuild executable commands from a specific discovery answer. */
    buildCommands: (descriptors: readonly SessionCommandDescriptor[]) =>
      buildRuntimeCommands(descriptors, availability, deps),
    refreshRuntimeCommands,
    status: discovery.status,
    isError: discovery.isError,
    isFetching: discovery.isFetching,
  };
}
