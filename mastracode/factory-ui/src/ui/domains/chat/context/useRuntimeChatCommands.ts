import { prepareSessionCommandViaFetch, useSessionCommandsQuery } from '../services/sessionCommands';
import type { ResolvedChatCommand } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import type { ChatPhase } from './useBuiltInChatCommands';
import { useChatSessionContext } from './useChatSessionContext';
import { useChatTranscript } from './useChatTranscript';
import { useSendAgentControllerMessageMutation } from '../../../../hooks/useAgentControllerRunMutations';
import { useSetAgentControllerGoalMutation } from '../../../../hooks/useAgentControllerGoalMutations';

const DRAFT_REASON = 'This command needs a session. Send a prompt to create one first.';
const PREPARING_REASON = 'Commands run once the session is ready.';

/**
 * Server-discovered custom commands and skills as executable commands. Every
 * execution re-prepares server-side (fresh discovery + expansion) before the
 * result is submitted, so a stale suggestion can never send stale content.
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

  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const sendMutation = useSendAgentControllerMessageMutation(hookArgs);
  const setGoalMutation = useSetAgentControllerGoalMutation(hookArgs);

  const availability: ResolvedChatCommand['availability'] =
    phase === 'ready' || phase === 'busy'
      ? { state: 'available' }
      : { state: 'unavailable', reason: phase === 'draft' ? DRAFT_REASON : PREPARING_REASON };

  const prepareAndSubmit = async (invocation: string, rawArguments: string, originalText: string): Promise<void> => {
    const outcome = await prepareSessionCommandViaFetch(address, {
      command: invocation,
      ...(rawArguments ? { arguments: rawArguments } : {}),
    });
    if (outcome.action === 'message') {
      // The optimistic row shows what the user typed; the model receives the
      // server-expanded envelope instead of the raw slash text.
      const localId = localUser(originalText, busy);
      try {
        await sendMutation.mutateAsync({ text: outcome.content });
      } catch (error) {
        failLocalUser(localId);
        throw error;
      }
      return;
    }
    if (outcome.action === 'goal') {
      await setGoalMutation.mutateAsync({ objective: outcome.objective, trigger: true });
      return;
    }
    pushNotice(outcome.notice);
  };

  const descriptors = discovery.data?.commands ?? [];
  // Rebuilt each render like the built-ins: execution closures must see the
  // current address and transcript helpers.
  const commands: ResolvedChatCommand[] = descriptors.map(descriptor => ({
    id: `runtime:${descriptor.command}`,
    invocation: descriptor.command,
    description: descriptor.description || 'Custom command',
    availability,
    execute: async (rawArguments: string, originalText: string) => {
      try {
        await prepareAndSubmit(descriptor.command, rawArguments, originalText);
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
      pushNotice(
        skillNames.length
          ? `Skills:\n${skillNames.map(name => `  ${name}`).join('\n')}`
          : 'No invocable skills discovered.',
      );
    },
  };

  return {
    commands: [...commands, skillsCommand],
    refreshRuntimeCommands: () => discovery.refetch(),
    status: discovery.status,
    isError: discovery.isError,
    isFetching: discovery.isFetching,
  };
}
