import type { AgentControllerMessage, PermissionPolicy, ToolCategory } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { queryKeys } from '../../../../../shared/api/keys';
import { useActiveProjectContext } from '../../workspaces';
import { useChatConnection, useChatTranscript } from '../context/ChatSessionProvider';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatModels } from '../context/useChatModels';
import {
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
  useSetAgentControllerGoalMutation,
} from '../hooks/useAgentControllerGoalMutations';
import { useSetPermissionForCategoryMutation } from '../hooks/useAgentControllerPermissionMutations';
import { useAgentControllerPermissions } from '../hooks/useAgentControllerPermissions';
import {
  useAbortAgentControllerMutation,
  useFollowUpAgentControllerMutation,
  useSendAgentControllerMessageMutation,
  useSteerAgentControllerMutation,
} from '../hooks/useAgentControllerRunMutations';
import { useCreateAgentControllerThreadMutation } from '../hooks/useAgentControllerThreadMutations';
import { useTextareaAutoResize } from '../hooks/useTextareaAutoResize';
import { matchCommands, SLASH_COMMANDS } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';

type ComposerVariant = 'inline' | 'textarea';

const composerVariantClass: Record<ComposerVariant, string> = {
  inline: 'max-h-52 min-h-10 resize-none',
  textarea: 'max-h-64 min-h-28 resize-none',
};

const composerVariantRows: Record<ComposerVariant, number> = {
  inline: 1,
  textarea: 4,
};

type ComposerProps = {
  variant?: ComposerVariant;
  commandNameToApply: string | null;
  onCommandApplied: () => void;
};

export function Composer({ variant = 'inline', commandNameToApply, onCommandApplied }: ComposerProps) {
  const { activeProject } = useActiveProjectContext();
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useChatConnection();
  const { transcript, busy, localUser, reset, pushNotice } = useChatTranscript();
  const { activeModelId, setModel } = useChatModels();

  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const createThreadMutation = useCreateAgentControllerThreadMutation({ ...hookArgs, projectPath });
  const sendMutation = useSendAgentControllerMessageMutation(hookArgs);
  const steerMutation = useSteerAgentControllerMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);
  const followUpMutation = useFollowUpAgentControllerMutation(hookArgs);
  const setGoalMutation = useSetAgentControllerGoalMutation(hookArgs);
  const pauseGoalMutation = usePauseAgentControllerGoalMutation(hookArgs);
  const resumeGoalMutation = useResumeAgentControllerGoalMutation(hookArgs);
  const clearGoalMutation = useClearAgentControllerGoalMutation(hookArgs);
  const { data: permissionRules, isLoading: permissionsLoading } = useAgentControllerPermissions(hookArgs);
  const setPermissionForCategoryMutation = useSetPermissionForCategoryMutation(hookArgs);

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
    inputRef.current?.focus();
  };

  const applyCommand = (name: string) => {
    applyCommandDraft(name);
    onCommandApplied();
  };

  useEffect(() => {
    if (!commandNameToApply) {
      appliedCommandNameRef.current = null;
      return;
    }
    if (appliedCommandNameRef.current === commandNameToApply) return;
    appliedCommandNameRef.current = commandNameToApply;
    applyCommandDraft(commandNameToApply);
    onCommandApplied();
  }, [commandNameToApply, applyCommandDraft, onCommandApplied]);

  useTextareaAutoResize(inputRef, draft);

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
    queryClient.setQueryData(queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, resourceId, threadId), [message]);
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

  const followUp = async (text: string) => {
    if (!text.trim()) return;
    localUser(text);
    await followUpMutation.mutateAsync(text);
  };

  const setPermissionForCategory = (category: ToolCategory, policy: PermissionPolicy) =>
    setPermissionForCategoryMutation.mutateAsync({ category, policy });

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
    if (text.startsWith('/')) {
      const [cmd, ...rest] = text.slice(1).split(/\s+/);
      const arg = rest.join(' ');
      switch (cmd) {
        case 'model':
          if (arg) await setModel(arg);
          return;
        case 'goal':
          if (arg) await setGoalMutation.mutateAsync(arg);
          return;
        case 'goal-clear':
          await clearGoalMutation.mutateAsync();
          return;
        case 'goal-pause':
          await pauseGoalMutation.mutateAsync();
          return;
        case 'goal-resume':
          await resumeGoalMutation.mutateAsync();
          return;
        case 'permissions': {
          if (permissionsLoading) return;
          const rules = permissionRules ?? { categories: {}, tools: {} };
          const cats =
            Object.entries(rules.categories ?? {})
              .map(([k, v]) => `  ${k}: ${v}`)
              .join('\n') || '  (none)';
          const tools =
            Object.entries(rules.tools ?? {})
              .map(([k, v]) => `  ${k}: ${v}`)
              .join('\n') || '  (none)';
          pushNotice(`Categories:\n${cats}\nTools:\n${tools}`);
          return;
        }
        case 'yolo': {
          for (const cat of ['read', 'edit', 'execute', 'mcp', 'other'] as const) {
            await setPermissionForCategory(cat, 'allow');
          }
          pushNotice('YOLO mode: all tool categories set to auto-allow');
          return;
        }
        case 'cost': {
          const u = transcript.usage;
          if (!u?.totalTokens) pushNotice('No token usage recorded yet.');
          else
            pushNotice(
              `Tokens — prompt: ${u.promptTokens ?? 0}, completion: ${u.completionTokens ?? 0}, total: ${u.totalTokens}`,
            );
          return;
        }
        case 'think':
          pushNotice(
            'Extended thinking: steer the agent with "think step by step" or switch to a thinking-capable model.',
          );
          return;
        case 'om':
          pushNotice(`Observational memory phase: ${transcript.omPhase ?? 'idle'}`);
          return;
        case 'settings': {
          const lines = [
            `Project: ${activeProject?.name ?? '(none)'}`,
            `Path: ${activeProject?.path ?? '(default workspace)'}`,
            `Mode: ${transcript.modeId ?? '—'}`,
            `Model: ${activeModelId ?? '—'}`,
            `Thread: ${transcript.threadId ?? '—'}`,
            `Running: ${transcript.running}`,
          ];
          pushNotice(lines.join('\n'));
          return;
        }
        case 'follow-up':
        case 'followup':
          if (arg) await followUp(arg);
          return;
        case 'abort':
          await abortMutation.mutateAsync();
          return;
        case 'help': {
          const width = Math.max(...SLASH_COMMANDS.map(c => `/${c.name} ${c.args ?? ''}`.length));
          const lines = SLASH_COMMANDS.map(c => {
            const sig = `/${c.name} ${c.args ?? ''}`.padEnd(width);
            return `  ${sig}  — ${c.description}`;
          });
          pushNotice(['Available commands:', ...lines].join('\n'));
          return;
        }
        default:
          pushNotice(`Unknown command: /${cmd}. Type /help for available commands.`, 'error');
          return;
      }
    }

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
        rows={composerVariantRows[variant]}
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
