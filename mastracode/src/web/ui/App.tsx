import type { PlanResume } from '@mastra/client-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CommandPalette } from './CommandPalette';
import { matchCommands, SLASH_COMMANDS } from './commands';
import type { SlashCommand } from './commands';
import { GoalPanel, StatusLine, Transcript } from './components';
import {
  ArrowDownIcon,
  ChevronIcon,
  GearIcon,
  LogoMark,
  MenuIcon,
  MoonIcon,
  SendIcon,
  StopIcon,
  SunIcon,
  Wordmark,
} from './icons';
import {
  loadProjects,
  DEFAULT_RESOURCE_ID,
  ensureResourceId,
  loadActiveProjectId,
  saveActiveProjectId,
} from './projects';
import type { Project } from './projects';
import { ProjectsModal } from './ProjectsModal';
import { SettingsPanel } from './SettingsPanel';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { Sidebar } from './Sidebar';
import { applyDensity, applyTheme, loadDensity, loadTheme, saveDensity, saveTheme } from './theme';
import type { Density, Theme } from './theme';
import { useToast } from './toast';
import { useAgentControllerSession } from './useAgentControllerSession';

export default function App() {
  const { toast } = useToast();
  // ── Projects (localStorage) ─────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  // Restore the last active project on reload (if it still exists), so the
  // session reconnects and its threads reappear without re-selecting.
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const saved = loadActiveProjectId();
    return saved && loadProjects().some(p => p.id === saved) ? saved : null;
  });
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  // Persist the active project whenever it changes.
  useEffect(() => {
    saveActiveProjectId(activeProjectId);
  }, [activeProjectId]);

  // resourceId is the server-resolved (TUI-compatible) id, so a project opened
  // in the terminal and here share the same session. Stays disabled until the
  // active project's resourceId is known.
  const resourceId = activeProject?.resourceId ?? DEFAULT_RESOURCE_ID;
  const sessionEnabled = !!activeProject?.resourceId;

  const session = useAgentControllerSession({
    agentControllerId: 'code',
    resourceId,
    projectPath: activeProject?.path,
    enabled: sessionEnabled,
  });
  const { transcript, status, modes, threads, send, steer, abort, approveTool, respondSuspension } = session;
  const [draft, setDraft] = useState('');

  // Stable handlers for the memoized <Transcript>. The underlying hook methods
  // are already memoized, so these only change identity if the session does —
  // which keeps the heavy transcript subtree from re-rendering on every
  // composer keystroke.
  const onApprove = useCallback(
    (toolCallId: string, approved: boolean, id: string) => void approveTool(toolCallId, approved, id),
    [approveTool],
  );
  const onRespond = useCallback(
    (toolCallId: string, data: string | string[] | PlanResume, id: string) =>
      void respondSuspension(toolCallId, data, id),
    [respondSuspension],
  );
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      // `activeSuggestion` is reset by an effect that runs after render, so it
      // can momentarily point past a shrunk `suggestions` list. Clamp here so we
      // never dereference an out-of-range index.
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
        // If the draft already names a complete command exactly, let Enter submit
        // it (runs no-arg commands like /yolo). Otherwise complete the highlighted
        // suggestion so the user can type its args.
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
        setDraft('');
        return;
      }
    }
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  // Total text length of the most recent assistant entry — changes on every
  // streamed chunk, so the autoscroll effect can follow the stream smoothly
  // (not just when a whole new entry is appended).
  const lastTranscriptEntry = transcript.entries[transcript.entries.length - 1];
  const streamingLen =
    lastTranscriptEntry?.kind === 'assistant'
      ? lastTranscriptEntry.segments.reduce(
          (n, s) => (s.kind === 'text' || s.kind === 'thinking' ? n + s.text.length : n),
          0,
        )
      : 0;

  // True when the user has scrolled up far enough that new content would land
  // off-screen — drives the "jump to latest" button.
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Track the user's scroll position so we know whether to auto-follow the
  // stream and whether to show the jump-to-latest button.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      setShowScrollDown(!nearBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // When the loaded thread changes, jump straight to the most recent message
  // (no animation) so opening a conversation starts at the bottom, not the top.
  // Defer to the next frame so hydrated content is laid out before we measure.
  useEffect(() => {
    setShowScrollDown(false);
    const raf = requestAnimationFrame(() => scrollToBottom('auto'));
    return () => cancelAnimationFrame(raf);
  }, [transcript.threadId, scrollToBottom]);

  // Auto-scroll the transcript to follow new content. Only auto-follows when
  // the user is already near the bottom, so scrolling back to read history
  // isn't yanked away mid-stream.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [transcript.entries.length, transcript.running, transcript.pending, streamingLen]);

  // Auto-grow the composer textarea with its content (capped via CSS max-height).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  // The agent is "busy" while a run is active OR a just-sent turn is awaiting
  // its first response. `pending` latches synchronously on send/steer, so the
  // Stop button and thinking indicator stay reliable even when the run's
  // start/end events arrive batched together.
  const busy = transcript.running || transcript.pending;

  // Show the "thinking" indicator while busy but before any assistant text has
  // streamed for the current turn.
  const lastEntry = transcript.entries[transcript.entries.length - 1];
  const lastEntryHasText =
    lastEntry?.kind === 'assistant' && lastEntry.segments.some(s => s.kind === 'text' && s.text.trim().length > 0);
  const showWorkingIndicator = busy && !(lastEntry?.kind === 'assistant' && lastEntry.streaming && lastEntryHasText);

  // A restored active project from a pre-resourceId build won't have one yet;
  // backfill it so the session can connect. Runs once per project that needs it.
  const backfilledRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeProject && !activeProject.resourceId && backfilledRef.current !== activeProject.id) {
      backfilledRef.current = activeProject.id;
      void ensureResourceId(activeProject).then(() => setProjects(loadProjects()));
    }
  }, [activeProject]);

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

  const onSubmit = (e: { preventDefault: () => void }) => {
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

  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  // Apply the restored theme on mount (and whenever it changes).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const changeTheme = (next: Theme) => {
    setTheme(next);
    saveTheme(next);
  };
  const toggleTheme = () => changeTheme(theme === 'dark' ? 'light' : 'dark');

  // Density preference (comfortable/compact), persisted and applied to <html>.
  const [density, setDensity] = useState<Density>(() => loadDensity());
  useEffect(() => {
    applyDensity(density);
  }, [density]);
  const changeDensity = (next: Density) => {
    setDensity(next);
    saveDensity(next);
  };

  // Settings modal.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Pull fresh behavior settings from the server each time the modal opens so
  // the toggles reflect server truth (e.g. after a TUI session changed them).
  const refreshSettings = session.refreshSettings;
  useEffect(() => {
    if (settingsOpen) void refreshSettings();
  }, [settingsOpen, refreshSettings]);

  // App-level Projects modal (add / manage / switch). Auto-opens on first run
  // when no project has been added yet, since picking one is required to start.
  const [projectsOpen, setProjectsOpen] = useState(false);
  useEffect(() => {
    if (projects.length === 0) setProjectsOpen(true);
  }, [projects.length]);

  // Keyboard-shortcuts help overlay.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Off-canvas sidebar for narrow screens.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  // Command palette (Cmd/Ctrl+K).
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global keyboard shortcuts: Cmd/Ctrl+K toggles the palette; Escape closes
  // the palette/sidebar or aborts an in-flight run.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
        return;
      }
      // '?' opens the shortcuts help, but only when not typing in a field.
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen(o => !o);
        return;
      }
      if (e.key === 'Escape') {
        // ProjectsModal owns its own Escape (back-to-list vs close), so don't
        // double-handle it here.
        if (projectsOpen) return;
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (sidebarOpen) {
          setSidebarOpen(false);
          return;
        }
        if (busy) {
          void abort();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, sidebarOpen, busy, abort, settingsOpen, shortcutsOpen, projectsOpen]);

  // Run a command chosen from the palette. Commands that take arguments pre-fill
  // the composer (so the user can supply them); no-arg commands execute now.
  const runPaletteCommand = (command: SlashCommand) => {
    if (command.args) {
      applyCommand(command.name);
    } else {
      void handleInput(`/${command.name}`);
    }
  };

  return (
    <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onManageProjects={() => {
          setProjectsOpen(true);
          closeSidebar();
        }}
        threads={threads}
        activeThreadId={transcript.threadId}
        onSwitchThread={id => {
          void session.switchThread(id);
          closeSidebar();
        }}
        onCreateThread={title => {
          void session.createThread(title);
          toast('New thread created', 'success');
          closeSidebar();
        }}
        onDeleteThread={id => {
          void session.deleteThread(id);
          toast('Thread deleted');
        }}
        onRenameThread={(id, title) => {
          void session.renameThread(id, title);
          toast('Thread renamed', 'success');
        }}
        onCloneThread={id => {
          void session.cloneThread(id);
          toast('Thread cloned', 'success');
        }}
      />

      {/* Dim + dismiss overlay for the off-canvas sidebar on mobile. */}
      <div className="sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />

      <div className="app-main">
        <header className="header">
          <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)} title="Menu" aria-label="Toggle sidebar">
            <MenuIcon />
          </button>
          <button
            className="header-title"
            onClick={() => setProjectsOpen(true)}
            title={activeProject ? `${activeProject.path} — switch project` : 'Select a project'}
          >
            <LogoMark size={24} className="logo-mark" />
            <span className="header-name">{activeProject ? activeProject.name : 'MastraCode'}</span>
            <ChevronIcon size={14} className="header-title-chevron" />
          </button>
          <div className="header-actions">
            {activeProject &&
              modes.map(m => (
                <button
                  key={m.id}
                  className={`mode-btn ${transcript.modeId === m.id ? 'active' : ''}`}
                  data-mode={m.id}
                  onClick={() => void session.switchMode(m.id)}
                >
                  {m.name ?? m.id}
                </button>
              ))}
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              className="theme-toggle"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              aria-label="Open settings"
            >
              <GearIcon />
            </button>
          </div>
        </header>

        {!activeProject ? (
          <div className="no-project">
            <div className="no-project-icon">
              <LogoMark size={44} />
            </div>
            <h2>Welcome to MastraCode</h2>
            <p>
              Open a project folder to start a coding session. Each project keeps its own threads, memory, and workspace
              — shared with the terminal.
            </p>
            <button className="btn btn-primary no-project-cta" onClick={() => setProjectsOpen(true)}>
              Open a project
            </button>
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

            {(status === 'reconnecting' || status === 'error') && (
              <div className={`conn-banner ${status}`} role="status" aria-live="polite">
                <span className="conn-dot" />
                {status === 'reconnecting'
                  ? 'Connection lost — reconnecting…'
                  : 'Disconnected. Check the server and reload to reconnect.'}
              </div>
            )}

            <div className="transcript" ref={threadRef}>
              {transcript.entries.length === 0 && (
                <div className="transcript-empty">
                  <Wordmark />
                  <dl className="banner-meta">
                    <div className="banner-row">
                      <dt>Project</dt>
                      <dd>{activeProject.name}</dd>
                    </div>
                    {activeProject.resourceId && (
                      <div className="banner-row">
                        <dt>Resource ID</dt>
                        <dd>{activeProject.resourceId}</dd>
                      </div>
                    )}
                    {activeProject.gitBranch && (
                      <div className="banner-row">
                        <dt>Branch</dt>
                        <dd>{activeProject.gitBranch}</dd>
                      </div>
                    )}
                    <div className="banner-row">
                      <dt>Workspace</dt>
                      <dd>{activeProject.path}</dd>
                    </div>
                  </dl>
                  <p className="banner-ready">Ready for new conversation</p>
                </div>
              )}
              <Transcript entries={transcript.entries} onApprove={onApprove} onRespond={onRespond} />
              {showWorkingIndicator && (
                <div className="working-indicator" aria-live="polite" aria-label="Agent is working">
                  <span className="working-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="working-label">Thinking…</span>
                </div>
              )}
            </div>

            {showScrollDown && (
              <button
                type="button"
                className="scroll-bottom-btn"
                onClick={() => scrollToBottom('smooth')}
                title="Jump to latest"
                aria-label="Jump to latest message"
              >
                <ArrowDownIcon size={18} />
              </button>
            )}

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
              <textarea
                ref={inputRef}
                className="input composer-input"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder="Message the agent · / for commands · Shift+Enter for newline"
                rows={1}
                disabled={status === 'error'}
              />
              {busy ? (
                <button
                  type="button"
                  className="btn btn-danger btn-icon"
                  onClick={() => void abort()}
                  title="Stop"
                  aria-label="Stop"
                >
                  <StopIcon />
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary btn-icon"
                  disabled={status !== 'ready' || !draft.trim()}
                  title="Send"
                  aria-label="Send"
                >
                  <SendIcon />
                </button>
              )}
            </form>

            <StatusLine
              status={status}
              modeId={transcript.modeId}
              modeName={modes.find(m => m.id === transcript.modeId)?.name}
              modelId={transcript.modelId}
              running={busy}
              followUpCount={transcript.followUpCount}
              omPhase={transcript.omPhase}
              omProgress={transcript.omProgress}
              goal={transcript.goal}
              workspaceReady={transcript.workspaceReady}
              projectName={activeProject?.name}
              tokensPerSec={transcript.tokensPerSec}
            />
          </>
        )}
      </div>

      {paletteOpen && activeProject && (
        <CommandPalette onRun={runPaletteCommand} onClose={() => setPaletteOpen(false)} />
      )}

      {settingsOpen && (
        <SettingsPanel
          theme={theme}
          density={density}
          models={session.models}
          currentModelId={transcript.modelId ?? null}
          settings={session.settings}
          resourceId={sessionEnabled ? resourceId : undefined}
          onThemeChange={changeTheme}
          onDensityChange={changeDensity}
          onModelChange={modelId => {
            void session.switchModel(modelId);
            toast('Model updated', 'success');
          }}
          onBehaviorChange={updates => {
            void (async () => {
              await session.setState(updates);
              await session.refreshSettings();
              toast('Settings updated', 'success');
            })();
          }}
          getPermissions={session.getPermissions}
          setPermissionForCategory={session.setPermissionForCategory}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}

      {projectsOpen && (
        <ProjectsModal
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={p => void handleSelectProject(p)}
          onProjectsChange={setProjects}
          onClose={() => setProjectsOpen(false)}
        />
      )}
    </div>
  );
}
