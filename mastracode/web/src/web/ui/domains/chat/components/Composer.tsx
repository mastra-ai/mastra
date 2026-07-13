import type { AgentControllerMessage } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Square } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { queryKeys } from '../../../../../shared/api/keys';
import { useChatConnection } from '../context/useChatConnection';
import { useChatModels } from '../context/useChatModels';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { useRunChatCommand } from '../context/useRunChatCommand';
import { useSetAgentControllerGoalMutation } from '../../../../../shared/hooks/useAgentControllerGoalMutations';
import {
  useAbortAgentControllerMutation,
  useFollowUpAgentControllerMutation,
  useSendAgentControllerMessageMutation,
  useSteerAgentControllerMutation,
} from '../../../../../shared/hooks/useAgentControllerRunMutations';
import { useCreateAgentControllerThreadMutation } from '../../../../../shared/hooks/useAgentControllerThreadMutations';
import { matchCommands } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';

import { ComposerInput } from './ComposerInput';
import type { ComposerVariant } from './ComposerInput';

type ComposerProps = {
  variant?: ComposerVariant;
  draft?: string;
  onDraftChange?: (draft: string) => void;
};

export function Composer({ variant = 'inline', draft: controlledDraft, onDraftChange }: ComposerProps) {
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useChatConnection();
  const { busy, localUser } = useChatTranscript();
  const { setModel } = useChatModels();
  const { run: runChatCommand } = useRunChatCommand();

  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const createThreadMutation = useCreateAgentControllerThreadMutation({ ...hookArgs, projectPath });
  const sendMutation = useSendAgentControllerMessageMutation(hookArgs);
  const steerMutation = useSteerAgentControllerMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);
  const setGoalMutation = useSetAgentControllerGoalMutation(hookArgs);
  const followUpMutation = useFollowUpAgentControllerMutation(hookArgs);

  const [uncontrolledDraft, setUncontrolledDraft] = useState('');
  const draft = controlledDraft ?? uncontrolledDraft;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = matchCommands(draft);
  const showSuggestions = suggestions.length > 0;
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const updateDraft = (next: string) => {
    if (onDraftChange) onDraftChange(next);
    else setUncontrolledDraft(next);
    setActiveSuggestion(0);
  };

  const applyCommandDraft = (name: string) => {
    updateDraft(`/${name} `);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const createThread = async () => {
    const thread = await createThreadMutation.mutateAsync(undefined);
    return thread.id;
  };

  const seedThreadMessageCache = (threadId: string, text: string) => {
    const message: AgentControllerMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: [{ type: 'text', text }],
    };
    queryClient.setQueryData(queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, resourceId, threadId), [
      message,
    ]);
  };

  const send = async (text: string) => {
    if (!text.trim()) return;
    if (location.pathname === '/new') {
      const threadId = await createThread();
      localUser(text);
      await sendMutation.mutateAsync(text);
      seedThreadMessageCache(threadId, text);
      void navigate(`/threads/${threadId}`, { replace: true });
      return;
    }
    localUser(text);
    await sendMutation.mutateAsync(text);
  };

  const steer = async (text: string) => {
    if (!text.trim()) return;
    localUser(text, true);
    await steerMutation.mutateAsync(text);
  };

  async function runOnComposer(text: string) {
    if (!text.startsWith('/')) return false;

    const [name, ...rest] = text.slice(1).split(/\s+/);
    const argument = rest.join(' ');

    switch (name) {
      case 'model':
        if (argument) await setModel(argument);
        return true;
      case 'goal':
        if (argument) await setGoalMutation.mutateAsync(argument);
        return true;
      case 'follow-up':
      case 'followup':
        if (argument) {
          localUser(argument);
          await followUpMutation.mutateAsync(argument);
        }
        return true;
      default:
        await runChatCommand(name);
        return true;
    }
  }

  const onSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    updateDraft('');
    void handleInput(text);
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      const safeIndex = Math.min(activeSuggestion, suggestions.length - 1);
      const current = suggestions[safeIndex];
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSuggestion(index => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSuggestion(index => (index - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        if (current) applyCommandDraft(current.name);
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        const exact = !!current && draft.slice(1) === current.name && suggestions.length === 1;
        if (exact) {
          event.preventDefault();
          onSubmit(event);
          return;
        }
        event.preventDefault();
        if (current) applyCommandDraft(current.name);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        updateDraft('');
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit(event);
    }
  };

  async function handleInput(text: string) {
    if (await runOnComposer(text)) return;
    if (busy) await steer(text);
    else await send(text);
  }

  const disabled = status !== 'ready';

  return (
    <form onSubmit={onSubmit} className="relative flex w-full flex-col gap-2">
      <ComposerInput
        ref={inputRef}
        value={draft}
        onChange={event => updateDraft(event.target.value)}
        onKeyDown={onComposerKeyDown}
        placeholder={busy ? 'Steer the agent…' : 'Ask Mastra Code…'}
        disabled={disabled}
        composerVariant={variant}
        aria-label="Message"
      />
      {showSuggestions && (
        <div className="absolute bottom-full mb-2 w-full rounded-md border border-border1 bg-surface3 p-1 shadow-lg">
          {suggestions.map((command, index) => (
            <button
              key={command.name}
              type="button"
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-ui-sm ${index === activeSuggestion ? 'bg-surface4 text-icon6' : 'text-icon3'}`}
              onMouseDown={event => {
                event.preventDefault();
                applyCommandDraft(command.name);
              }}
            >
              <span>/{command.name}</span>
              <span>{command.description}</span>
            </button>
          ))}
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        {busy && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => void abortMutation.mutateAsync()}
            aria-label="Abort"
          >
            <Square size={14} />
          </Button>
        )}
        <Button type="submit" size="icon-sm" disabled={disabled || !draft.trim()} aria-label="Send message">
          <ArrowUp size={16} />
        </Button>
      </div>
    </form>
  );
}
