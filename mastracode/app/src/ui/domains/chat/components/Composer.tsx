import type { AgentControllerMessage } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Square } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { queryKeys } from '#shared/api/keys';

import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useAbortAgentControllerMutation,
  useSendAgentControllerMessageMutation,
  useSteerAgentControllerMutation,
} from '../hooks/useAgentControllerRunMutations';
import { useCreateAgentControllerThreadMutation } from '../hooks/useAgentControllerThreadMutations';
import { matchCommands } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';

type ComposerVariant = 'inline' | 'textarea';

const composerVariantClass: Record<ComposerVariant, string> = {
  inline: 'field-sizing-content max-h-52 min-h-10 resize-none',
  textarea: 'field-sizing-content max-h-64 min-h-28 resize-none',
};

type ComposerProps = {
  variant?: ComposerVariant;
};

export function Composer({ variant = 'inline' }: ComposerProps) {
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useChatConnection();
  const { busy, localUser, reset } = useChatTranscript();
  const { composerCommandName, clearComposerCommand, runComposerCommand } = useChatCommands();

  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const createThreadMutation = useCreateAgentControllerThreadMutation({ ...hookArgs, projectPath });
  const sendMutation = useSendAgentControllerMessageMutation(hookArgs);
  const steerMutation = useSteerAgentControllerMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);

  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const appliedCommandNameRef = useRef<string | null>(null);
  const suggestions = matchCommands(draft);
  const showSuggestions = suggestions.length > 0;
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const updateDraft = (next: string) => {
    setDraft(next);
    setActiveSuggestion(0);
  };

  const applyCommandDraft = (name: string) => {
    updateDraft(`/${name} `);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const applyCommand = (name: string) => {
    applyCommandDraft(name);
    clearComposerCommand();
  };
  const applyComposerCommand = useEffectEvent((name: string) => {
    applyCommandDraft(name);
    clearComposerCommand();
  });

  useEffect(() => {
    if (!composerCommandName) {
      appliedCommandNameRef.current = null;
      return;
    }
    if (appliedCommandNameRef.current === composerCommandName) return;
    appliedCommandNameRef.current = composerCommandName;
    applyComposerCommand(composerCommandName);
  }, [composerCommandName]);

  const createThread = async () => {
    const thread = await createThreadMutation.mutateAsync(undefined);
    reset(thread.id);
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

  const onSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    updateDraft('');
    void handleInput(text);
  };

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      const safeIndex = Math.min(activeSuggestion, suggestions.length - 1);
      const current = suggestions[safeIndex];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion(i => (i + 1) % suggestions.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion(i => (i - 1 + suggestions.length) % suggestions.length);
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (current) applyCommand(current.name);
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        const exact = !!current && draft.slice(1) === current.name && suggestions.length === 1;
        if (exact) {
          e.preventDefault();
          onSubmit(e);
          return;
        }
        e.preventDefault();
        if (current) applyCommand(current.name);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        updateDraft('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  async function handleInput(text: string) {
    if (await runComposerCommand(text)) return;
    if (busy) await steer(text);
    else await send(text);
  }

  const disabled = status !== 'ready';

  return (
    <form onSubmit={onSubmit} className="relative flex w-full flex-col gap-2">
      <Textarea
        ref={inputRef}
        value={draft}
        onChange={e => updateDraft(e.target.value)}
        onKeyDown={onComposerKeyDown}
        placeholder={busy ? 'Steer the agent…' : 'Ask Mastra Code…'}
        disabled={disabled}
        className={composerVariantClass[variant]}
        aria-label="Message"
      />
      {showSuggestions && (
        <div className="absolute bottom-full mb-2 w-full rounded-md border border-border1 bg-surface3 p-1 shadow-lg">
          {suggestions.map((cmd, index) => (
            <button
              key={cmd.name}
              type="button"
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-ui-sm ${index === activeSuggestion ? 'bg-surface4 text-icon6' : 'text-icon3'}`}
              onMouseDown={e => {
                e.preventDefault();
                applyCommand(cmd.name);
              }}
            >
              <span>/{cmd.name}</span>
              <span>{cmd.description}</span>
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
