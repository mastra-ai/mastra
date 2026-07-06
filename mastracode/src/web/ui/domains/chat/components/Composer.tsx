import { Button } from '@mastra/playground-ui/components/Button';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { ArrowUp, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import type { Project } from '../../workspaces';
import type { useAgentControllerSession } from '../hooks/useAgentControllerSession';
import { useTextareaAutoResize } from '../hooks/useTextareaAutoResize';
import { matchCommands, SLASH_COMMANDS } from '../services/commands';

type Session = ReturnType<typeof useAgentControllerSession>;
type Transcript = Session['transcript'];

type ComposerProps = {
  activeProject: Project | null;
  transcript: Transcript;
  status: Session['status'];
  busy: boolean;
  send: Session['send'];
  steer: Session['steer'];
  abort: Session['abort'];
  commandNameToApply: string | null;
  onCommandApplied: () => void;
  session: Pick<
    Session,
    | 'switchModel'
    | 'setGoal'
    | 'clearGoal'
    | 'pauseGoal'
    | 'resumeGoal'
    | 'getPermissions'
    | 'setPermissionForCategory'
    | 'pushNotice'
    | 'followUp'
    | 'abort'
  >;
};

export function Composer({
  activeProject,
  transcript,
  status,
  busy,
  send,
  steer,
  abort,
  commandNameToApply,
  onCommandApplied,
  session,
}: ComposerProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = useMemo(() => matchCommands(draft), [draft]);
  const showSuggestions = suggestions.length > 0;
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  // Reset the highlighted suggestion whenever the draft changes, in the same
  // event that changes it (no effect — avoids a second render pass).
  const updateDraft = (next: string) => {
    setDraft(next);
    setActiveSuggestion(0);
  };

  const applyCommand = (name: string) => {
    updateDraft(`/${name} `);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!commandNameToApply) return;
    applyCommand(commandNameToApply);
    onCommandApplied();
  }, [commandNameToApply, onCommandApplied]);

  useTextareaAutoResize(inputRef, draft);

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
          if (arg) await session.switchModel(arg);
          return;
        case 'goal':
          if (arg) await session.setGoal(arg);
          return;
        case 'goal-clear':
          await session.clearGoal();
          return;
        case 'goal-pause':
          await session.pauseGoal();
          return;
        case 'goal-resume':
          await session.resumeGoal();
          return;
        case 'permissions': {
          const rules = await session.getPermissions();
          const cats =
            Object.entries(rules.categories ?? {})
              .map(([k, v]) => `  ${k}: ${v}`)
              .join('\n') || '  (none)';
          const tools =
            Object.entries(rules.tools ?? {})
              .map(([k, v]) => `  ${k}: ${v}`)
              .join('\n') || '  (none)';
          session.pushNotice(`Categories:\n${cats}\nTools:\n${tools}`);
          return;
        }
        case 'yolo': {
          for (const cat of ['read', 'edit', 'execute', 'mcp', 'other'] as const) {
            await session.setPermissionForCategory(cat, 'allow');
          }
          session.pushNotice('YOLO mode: all tool categories set to auto-allow');
          return;
        }
        case 'cost': {
          const u = transcript.usage;
          if (!u?.totalTokens) session.pushNotice('No token usage recorded yet.');
          else
            session.pushNotice(
              `Tokens — prompt: ${u.promptTokens ?? 0}, completion: ${u.completionTokens ?? 0}, total: ${u.totalTokens}`,
            );
          return;
        }
        case 'think':
          session.pushNotice(
            'Extended thinking: steer the agent with "think step by step" or switch to a thinking-capable model.',
          );
          return;
        case 'om':
          session.pushNotice(`Observational memory phase: ${transcript.omPhase ?? 'idle'}`);
          return;
        case 'settings': {
          const lines = [
            `Project: ${activeProject?.name ?? '(none)'}`,
            `Path: ${activeProject?.path ?? '(default workspace)'}`,
            `Mode: ${transcript.modeId ?? '—'}`,
            `Model: ${transcript.modelId ?? '—'}`,
            `Thread: ${transcript.threadId ?? '—'}`,
            `Running: ${transcript.running}`,
          ];
          session.pushNotice(lines.join('\n'));
          return;
        }
        case 'follow-up':
        case 'followup':
          if (arg) await session.followUp(arg);
          return;
        case 'abort':
          await session.abort();
          return;
        case 'help': {
          const width = Math.max(...SLASH_COMMANDS.map(c => `/${c.name} ${c.args ?? ''}`.length));
          const lines = SLASH_COMMANDS.map(c => {
            const sig = `/${c.name} ${c.args ?? ''}`.padEnd(width);
            return `  ${sig}  — ${c.description}`;
          });
          session.pushNotice(['Available commands:', ...lines].join('\n'));
          return;
        }
        default:
          session.pushNotice(`Unknown command: /${cmd}. Type /help for available commands.`, 'error');
          return;
      }
    }
    if (busy) await steer(text);
    else await send(text);
  }

  return (
    <form className="relative flex items-end gap-2 py-1" onSubmit={onSubmit}>
      {showSuggestions && (
        <div className="absolute bottom-full left-4 right-4 z-50 mb-1 max-h-64 overflow-y-auto rounded-md border border-border1 bg-surface2 shadow-lg">
          {suggestions.map((c, i) => (
            <button
              type="button"
              key={c.name}
              className={`grid w-full items-baseline gap-2 px-3 py-1.5 text-left text-icon5 ${
                i === activeSuggestion ? 'bg-surface4' : 'hover:bg-surface3'
              }`}
              style={{ gridTemplateColumns: 'max-content max-content 1fr' }}
              onMouseEnter={() => setActiveSuggestion(i)}
              onClick={() => applyCommand(c.name)}
            >
              <span className="font-mono text-accent3">/{c.name}</span>
              {c.args && <span className="font-mono text-xs text-icon3">{c.args}</span>}
              <span className="truncate text-xs text-icon3">{c.description}</span>
            </button>
          ))}
        </div>
      )}
      <Textarea
        ref={inputRef}
        className="max-h-52 min-h-10 resize-none"
        value={draft}
        onChange={e => updateDraft(e.target.value)}
        onKeyDown={onComposerKeyDown}
        placeholder="Message the agent · / for commands · Shift+Enter for newline"
        rows={1}
        disabled={status === 'error'}
      />
      {busy ? (
        <Button
          type="button"
          variant="default"
          size="icon-md"
          className="shrink-0 text-accent2"
          onClick={() => void abort()}
          aria-label="Stop"
        >
          <Square />
        </Button>
      ) : (
        <Button
          type="submit"
          variant="primary"
          size="icon-md"
          className="shrink-0"
          disabled={status !== 'ready' || !draft.trim()}
          aria-label="Send"
        >
          <ArrowUp />
        </Button>
      )}
    </form>
  );
}
