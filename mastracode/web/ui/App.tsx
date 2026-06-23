import { useEffect, useMemo, useRef, useState } from 'react';

import { matchCommands, SLASH_COMMANDS } from './commands';
import { GoalPanel, StatusLine, Transcript } from './components';
import { loadProjects, DEFAULT_RESOURCE_ID, ensureResourceId } from './projects';
import type { Project } from './projects';
import { Sidebar } from './Sidebar';
import { useHarnessSession } from './useHarnessSession';

export default function App() {
  // ── Projects (localStorage) ─────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  // resourceId is the server-resolved (TUI-compatible) id, so a project opened
  // in the terminal and here share the same session. Stays disabled until the
  // active project's resourceId is known.
  const resourceId = activeProject?.resourceId ?? DEFAULT_RESOURCE_ID;
  const sessionEnabled = !!activeProject?.resourceId;

  const session = useHarnessSession({ harnessId: 'code', resourceId, enabled: sessionEnabled });
  const { transcript, status, modes, threads, send, steer, abort } = session;
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Slash-command autocomplete ──────────────────────────────────────
  const suggestions = useMemo(() => matchCommands(draft), [draft]);
  const showSuggestions = suggestions.length > 0;
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  // Reset the highlighted item whenever the suggestion set changes.
  useEffect(() => {
    setActiveSuggestion(0);
  }, [draft]);

  /** Insert the chosen command into the draft, ready for its args. */
  const applyCommand = (name: string) => {
    setDraft(`/${name} `);
    inputRef.current?.focus();
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      applyCommand(suggestions[activeSuggestion]!.name);
    } else if (e.key === 'Enter') {
      // If the draft already names a complete command exactly, let Enter submit
      // it (runs no-arg commands like /yolo). Otherwise complete the highlighted
      // suggestion so the user can type its args.
      const exact = draft.slice(1) === suggestions[activeSuggestion]!.name && suggestions.length === 1;
      if (exact) return; // fall through to the form's onSubmit
      e.preventDefault();
      applyCommand(suggestions[activeSuggestion]!.name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraft('');
    }
  };

  // Auto-scroll the transcript.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [transcript.entries.length, transcript.running]);

  // When a project is selected, ensure it has a server-resolved (TUI-matching)
  // resourceId, then activate it. The hook re-mounts with that resourceId,
  // creating/resuming the shared session; projectPath is pushed once connected.
  const handleSelectProject = async (project: Project | null) => {
    if (!project) {
      setActiveProjectId(null);
      return;
    }
    // Backfill resourceId for legacy projects created before it was stored.
    if (!project.resourceId) {
      try {
        const filled = await ensureResourceId(project);
        setProjects(loadProjects());
        setActiveProjectId(filled.id);
        return;
      } catch {
        // Resolution failed (path gone?); activate anyway with default scope.
      }
    }
    setActiveProjectId(project.id);
  };

  // After the session connects for a new project, set projectPath.
  const prevResourceId = useRef(resourceId);
  useEffect(() => {
    if (resourceId !== prevResourceId.current) {
      prevResourceId.current = resourceId;
      if (status === 'ready') {
        void session.setState({ projectPath: activeProject?.path ?? '' });
      }
    }
  }, [resourceId, status, activeProject, session]);

  // Also set projectPath on initial connection for the active project.
  const initialSet = useRef(false);
  useEffect(() => {
    if (status === 'ready' && !initialSet.current && activeProject) {
      initialSet.current = true;
      void session.setState({ projectPath: activeProject.path });
    }
  }, [status, activeProject, session]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void handleInput(text);
  };

  async function handleInput(text: string) {
    if (text.startsWith('/')) {
      const [cmd, ...rest] = text.slice(1).split(/\s+/);
      const arg = rest.join(' ');
      switch (cmd) {
        case 'mode': if (arg) await session.switchMode(arg); return;
        case 'model': if (arg) await session.switchModel(arg); return;
        case 'new': await session.createThread(arg || undefined); return;
        case 'rename':
          if (arg && transcript.threadId) await session.renameThread(transcript.threadId, arg);
          return;
        case 'delete': if (arg) await session.deleteThread(arg); return;
        case 'clone': await session.cloneThread(); return;
        case 'goal': if (arg) await session.setGoal(arg); return;
        case 'goal-clear': await session.clearGoal(); return;
        case 'goal-pause': await session.pauseGoal(); return;
        case 'goal-resume': await session.resumeGoal(); return;
        case 'permissions': {
          const rules = await session.getPermissions();
          const cats = Object.entries(rules.categories ?? {}).map(([k, v]) => `  ${k}: ${v}`).join('\n') || '  (none)';
          const tools = Object.entries(rules.tools ?? {}).map(([k, v]) => `  ${k}: ${v}`).join('\n') || '  (none)';
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
          else session.pushNotice(`Tokens — prompt: ${u.promptTokens ?? 0}, completion: ${u.completionTokens ?? 0}, total: ${u.totalTokens}`);
          return;
        }
        case 'think':
          session.pushNotice('Extended thinking: steer the agent with "think step by step" or switch to a thinking-capable model.');
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
        case 'followup': if (arg) await session.followUp(arg); return;
        case 'abort': await session.abort(); return;
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
    if (transcript.running) await steer(text);
    else await send(text);
  }

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div className="app-layout">
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={p => void handleSelectProject(p)}
        onProjectsChange={setProjects}
        threads={threads}
        activeThreadId={transcript.threadId}
        onSwitchThread={id => { void session.switchThread(id); }}
        onCreateThread={title => { void session.createThread(title); }}
        onDeleteThread={id => { void session.deleteThread(id); }}
      />

      <div className="app-main">
        <header className="header">
          <span className="header-title">
            {activeProject ? activeProject.name : 'MastraCode'}
          </span>
          <div className="header-actions">
            {activeProject && modes.map(m => (
              <button
                key={m.id}
                className={`mode-btn ${transcript.modeId === m.id ? 'active' : ''}`}
                onClick={() => void session.switchMode(m.id)}
              >
                {m.name ?? m.id}
              </button>
            ))}
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {!activeProject ? (
          <div className="no-project">
            <div className="no-project-icon">📁</div>
            <h2>No project selected</h2>
            <p>Add a project in the sidebar to start a coding session. Threads live inside a project.</p>
          </div>
        ) : (
        <>
        {transcript.goal && (
          <GoalPanel
            goal={transcript.goal}
            onSetGoal={o => void session.setGoal(o)}
            onPauseGoal={() => void session.pauseGoal()}
            onResumeGoal={() => void session.resumeGoal()}
            onClearGoal={() => void session.clearGoal()}
          />
        )}

        <div className="transcript" ref={threadRef}>
          {transcript.entries.length === 0 && (
            <div className="transcript-empty">
              Working in {activeProject.name}. Ask the agent to read, write, or run code.
            </div>
          )}
          <Transcript
            entries={transcript.entries}
            onApprove={(toolCallId, approved, id) => void session.approveTool(toolCallId, approved, id)}
            onRespond={(toolCallId, data, id) => void session.respondSuspension(toolCallId, data, id)}
          />
        </div>

        <form className="composer" onSubmit={onSubmit}>
          {showSuggestions && (
            <div className="cmd-menu">
              {suggestions.map((c, i) => (
                <button
                  type="button"
                  key={c.name}
                  className={`cmd-item ${i === activeSuggestion ? 'active' : ''}`}
                  onMouseEnter={() => setActiveSuggestion(i)}
                  onClick={() => applyCommand(c.name)}
                >
                  <span className="cmd-name">/{c.name}</span>
                  {c.args && <span className="cmd-args">{c.args}</span>}
                  <span className="cmd-desc">{c.description}</span>
                </button>
              ))}
            </div>
          )}
          <input
            ref={inputRef}
            className="input composer-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Message the agent, or /mode plan..."
            disabled={status === 'error'}
          />
          {transcript.running ? (
            <button type="button" className="btn btn-danger" onClick={() => void abort()}>Stop</button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={status !== 'ready' || !draft.trim()}>Send</button>
          )}
        </form>

        <StatusLine
          status={status}
          modeId={transcript.modeId}
          modelId={transcript.modelId}
          running={transcript.running}
          followUpCount={transcript.followUpCount}
          omPhase={transcript.omPhase}
          usage={transcript.usage}
          workspaceReady={transcript.workspaceReady}
          projectName={activeProject?.name}
        />
        </>
        )}
      </div>
    </div>
  );
}
