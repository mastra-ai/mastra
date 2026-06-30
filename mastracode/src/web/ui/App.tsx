import type { PlanResume } from '@mastra/client-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useApiConfig } from '../../shared/api/config';
import { fetchAuthState, redirectToLogin } from './auth';
import type { WebAuthState } from './auth';
import { CommandPalette } from './CommandPalette';
import { matchCommands, SLASH_COMMANDS } from './commands';
import type { SlashCommand } from './commands';
import { GoalPanel, StatusLine, Transcript } from './components';
import { createWorktree, ensureRepoMaterialized, fetchGithubStatus } from './github';
import type { GithubStatus } from './github';
import { GithubConnectModal } from './GithubConnectModal';
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
  updateProject,
  projectWorktrees,
  selectedWorktree,
  selectWorktree,
  upsertWorktree,
} from './projects';
import type { Project, Worktree } from './projects';
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
  const { baseUrl } = useApiConfig();

  // ── Optional WorkOS auth identity ───────────────────────────────────
  // Populated from /auth/me. When the server has no auth configured this stays
  // disabled and no sign-out UI is shown.
  const [authState, setAuthState] = useState<WebAuthState>({ authEnabled: false, authenticated: false });
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    void fetchAuthState()
      .then(setAuthState)
      .finally(() => setAuthLoading(false));
  }, []);
  const signOut = useCallback(() => {
    window.location.assign('/auth/logout');
  }, []);

  // ── Optional GitHub App integration ─────────────────────────────────
  // Only meaningful when authenticated. Disabled status hides all GitHub UI.
  const [githubStatus, setGithubStatus] = useState<GithubStatus>({
    enabled: false,
    connected: false,
    installations: [],
  });
  const githubEnabled = githubStatus.enabled;
  const [githubOpen, setGithubOpen] = useState(false);
  useEffect(() => {
    if (authState.authEnabled && !authState.authenticated) return;
    void fetchGithubStatus().then(setGithubStatus);
  }, [authState.authEnabled, authState.authenticated]);

  // After the install/connect redirect lands back on `/?github=connected`,
  // re-fetch status, open the repo picker, and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('github') !== 'connected') return;
    params.delete('github');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    void fetchGithubStatus().then(s => {
      setGithubStatus(s);
      if (s.enabled) setGithubOpen(true);
    });
  }, []);

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

  // The selected workspace (git worktree) for a GitHub project. One resourceId
  // is shared across a repo's worktrees (and with the TUI), so threads are
  // partitioned per worktree by the `projectPath` tag, not by resourceId.
  const activeWorktree = activeProject?.source === 'github' ? selectedWorktree(activeProject) : undefined;

  // resourceId is the server-resolved (TUI-compatible) id, so a project opened
  // in the terminal and here share the same session. Stays disabled until the
  // active project's resourceId is known.
  const resourceId = activeProject?.resourceId ?? DEFAULT_RESOURCE_ID;

  // Thread-scoping tag: the worktree path for GitHub projects (so each
  // workspace keeps its own threads), or the filesystem path for local ones.
  const sessionProjectPath = activeWorktree?.worktreePath ?? activeProject?.path;

  // Stay disabled until the session can be created with a stable scoping tag.
  // For GitHub projects the worktree path (projectPath) is the thread tag, so
  // we must wait for it to resolve — otherwise the auto-created thread is
  // stamped with an empty tag and never shows up in the worktree's list.
  const sessionEnabled = !!activeProject?.resourceId && (activeProject.source !== 'github' || !!sessionProjectPath);

  const session = useAgentControllerSession({
    agentControllerId: 'code',
    resourceId,
    projectPath: sessionProjectPath,
    baseUrl,
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
    lastTranscriptEntry?.kind === 'message' && lastTranscriptEntry.message.role === 'assistant'
      ? lastTranscriptEntry.message.content.parts.reduce((n, part) => {
          if (part.type === 'text') return n + part.text.length;
          if (part.type === 'reasoning') return n + part.reasoning.length;
          return n;
        }, 0)
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
    lastEntry?.kind === 'message' &&
    lastEntry.message.role === 'assistant' &&
    lastEntry.message.content.parts.some(part => part.type === 'text' && part.text.trim().length > 0);
  const showWorkingIndicator =
    busy &&
    !(
      lastEntry?.kind === 'message' &&
      lastEntry.message.role === 'assistant' &&
      lastEntry.streaming &&
      lastEntryHasText
    );

  // A restored active project from a pre-resourceId build won't have one yet;
  // backfill it so the session can connect. Runs once per project that needs it.
  const backfilledRef = useRef<string | null>(null);
  useEffect(() => {
    // GitHub projects are resolved via materialize-on-open, not path resolution.
    if (
      activeProject &&
      activeProject.source !== 'github' &&
      !activeProject.resourceId &&
      backfilledRef.current !== activeProject.id
    ) {
      backfilledRef.current = activeProject.id;
      void ensureResourceId(activeProject).then(() => setProjects(loadProjects()));
    }
  }, [activeProject]);

  // Sandbox binding for the active GitHub project, pushed into session state once
  // the session connects so `getDynamicWorkspace` reattaches the right sandbox.
  const githubBindingRef = useRef<{ githubProjectId: string; sandboxId: string; sandboxWorkdir: string } | null>(null);

  // When a project is selected, ensure it has a server-resolved (TUI-matching)
  // resourceId, then activate it. The hook re-mounts with that resourceId,
  // creating/resuming the shared session; projectPath is pushed once connected.
  const [preparing, setPreparing] = useState(false);
  const [prepareStatus, setPrepareStatus] = useState('Preparing sandbox…');
  const handleSelectProject = async (project: Project | null) => {
    if (!project) {
      setActiveProjectId(null);
      return;
    }

    // GitHub projects are materialized into a cloud sandbox on open: provision/
    // reattach the sandbox, clone/pull the repo, then bind the sandbox into the
    // session state so the workspace reattaches to it.
    if (project.source === 'github' && project.githubProjectId) {
      setPrepareStatus('Preparing sandbox…');
      setPreparing(true);
      try {
        const result = await ensureRepoMaterialized(project.githubProjectId, ev => setPrepareStatus(ev.message));
        githubBindingRef.current = {
          githubProjectId: result.githubProjectId,
          sandboxId: result.sandboxId,
          sandboxWorkdir: result.sandboxWorkdir,
        };
        // Persist the sandbox binding on the project so a re-opened project
        // (e.g. after a reload, before the ref is repopulated) still has the
        // sandbox id/workdir available for the workspace to reattach. Seed the
        // repo-root worktree so the worktree tree always has a base entry.
        const rootBranch = project.gitBranch ?? 'main';
        const rootWorktree: Worktree = {
          branch: rootBranch,
          worktreePath: result.sandboxWorkdir,
          baseBranch: rootBranch,
        };
        const existingWorktrees = project.worktrees?.filter(w => w.worktreePath !== result.sandboxWorkdir) ?? [];
        const filled: Project = {
          ...project,
          resourceId: result.resourceId,
          sandboxId: result.sandboxId,
          sandboxWorkdir: result.sandboxWorkdir,
          worktrees: [rootWorktree, ...existingWorktrees],
        };
        updateProject(filled);
        setProjects(loadProjects());
        setActiveProjectId(filled.id);
      } catch (e) {
        const code = (e as { code?: string }).code;
        const msg =
          code === 'sandbox_not_configured'
            ? 'This server has no sandbox provider configured, so GitHub repos can’t be opened.'
            : e instanceof Error
              ? e.message
              : String(e);
        toast(msg, 'error');
      } finally {
        setPreparing(false);
      }
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

  // The session-state payload that binds the workspace to the active project:
  // a path for local projects, or the sandbox binding for GitHub projects.
  const projectStatePayload = useCallback((): Record<string, unknown> => {
    if (activeProject?.source === 'github') {
      // Prefer the freshly materialized binding from this open; fall back to the
      // binding persisted on the project (e.g. after a page reload).
      const binding =
        githubBindingRef.current && githubBindingRef.current.githubProjectId === activeProject.githubProjectId
          ? githubBindingRef.current
          : null;
      const worktree = selectedWorktree(activeProject);
      return {
        // projectPath doubles as the per-worktree thread-scoping tag, so it must
        // be the selected worktree path (matching the session prop), not empty.
        projectPath: worktree?.worktreePath ?? '',
        githubProjectId: activeProject.githubProjectId,
        sandboxId: binding?.sandboxId ?? activeProject.sandboxId,
        sandboxWorkdir: binding?.sandboxWorkdir ?? activeProject.sandboxWorkdir,
        // Bind the agent's workspace to the selected worktree so file edits +
        // commands run against that branch's checkout, not the repo root.
        worktreePath: worktree?.worktreePath,
        branch: worktree?.branch,
      };
    }
    return { projectPath: activeProject?.path ?? '' };
  }, [activeProject]);

  // Switch the active workspace to an existing worktree: persist the selection
  // and rebind the session (which re-tags threads via projectPath and points
  // the workspace at the worktree checkout).
  const handleSelectWorktree = useCallback(
    (worktreePath: string) => {
      if (!activeProject || activeProject.source !== 'github') return;
      const updated = selectWorktree(activeProject, worktreePath);
      setProjects(loadProjects());
      const worktree = updated.worktrees?.find(w => w.worktreePath === worktreePath);
      void session.setState({
        projectPath: worktreePath,
        worktreePath,
        branch: worktree?.branch,
      });
    },
    [activeProject, session],
  );

  // Create a new worktree (feature branch) in the sandbox, append it to the
  // project's worktree list, then select it as the active workspace.
  const handleCreateWorktree = useCallback(
    async (branch: string, baseBranch?: string) => {
      if (!activeProject || activeProject.source !== 'github' || !activeProject.githubProjectId) return;
      const result = await createWorktree(activeProject.githubProjectId, branch, baseBranch);
      const worktree: Worktree = {
        branch: result.branch,
        worktreePath: result.worktreePath,
        baseBranch: result.baseBranch,
      };
      const withWorktree = upsertWorktree(activeProject, worktree);
      const selected = selectWorktree(withWorktree, worktree.worktreePath);
      setProjects(loadProjects());
      void session.setState({
        projectPath: worktree.worktreePath,
        worktreePath: worktree.worktreePath,
        branch: worktree.branch,
      });
      return selected;
    },
    [activeProject, session],
  );

  // After the session connects for a new project, push its workspace binding.
  // Only advance the tracked resourceId once the session is actually ready and
  // the state has been pushed; otherwise a resourceId change that arrives before
  // `status === 'ready'` would mark itself handled and never push the binding.
  const prevResourceId = useRef(resourceId);
  useEffect(() => {
    if (resourceId !== prevResourceId.current && status === 'ready') {
      prevResourceId.current = resourceId;
      void session.setState(projectStatePayload());
    }
  }, [resourceId, status, projectStatePayload, session]);

  // Also push the binding on initial connection for the active project.
  const initialSet = useRef(false);
  useEffect(() => {
    if (status === 'ready' && !initialSet.current && activeProject) {
      initialSet.current = true;
      void session.setState(projectStatePayload());
    }
  }, [status, activeProject, projectStatePayload, session]);

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

  // ── Auth gate ───────────────────────────────────────────────────────
  // While the initial /auth/me check is in flight, render nothing to avoid a
  // splash flash. When auth is enabled but the user is signed out, show the
  // splash; the user explicitly chooses to sign in (no auto-redirect).
  if (authLoading) {
    return <div className="auth-splash auth-splash-loading" />;
  }
  if (authState.authEnabled && !authState.authenticated) {
    return (
      <div className="auth-splash">
        <div className="auth-splash-card">
          <div className="auth-splash-brand">
            <LogoMark size={36} className="auth-splash-logo" />
            <span className="auth-splash-wordmark">
              Mastra<span className="auth-splash-wordmark-accent">Code</span>
            </span>
          </div>
          <h1 className="auth-splash-title">Welcome back</h1>
          <p className="auth-splash-tagline">
            Sign in to your account to access your projects and pick up where you left off.
          </p>
          <button type="button" className="auth-splash-button" onClick={redirectToLogin}>
            Continue with WorkOS
            <span className="auth-splash-button-arrow" aria-hidden="true">
              →
            </span>
          </button>
          <p className="auth-splash-footnote">Secured by WorkOS · single sign-on</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onManageProjects={() => {
          setProjectsOpen(true);
          closeSidebar();
        }}
        onConnectGithub={
          githubEnabled
            ? () => {
                setGithubOpen(true);
                closeSidebar();
              }
            : undefined
        }
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
        worktrees={activeProject?.source === 'github' ? projectWorktrees(activeProject) : undefined}
        selectedWorktreePath={activeWorktree?.worktreePath}
        onSelectWorktree={path => {
          handleSelectWorktree(path);
          closeSidebar();
        }}
        onCreateWorktree={async (branch, baseBranch) => {
          // Let the Sidebar surface failures inline (it keeps the input open for
          // retry); we only handle the success path here.
          await handleCreateWorktree(branch, baseBranch);
          toast(`Worktree ${branch} ready`, 'success');
          closeSidebar();
        }}
        account={
          authState.authEnabled && authState.authenticated ? { user: authState.user, onSignOut: signOut } : undefined
        }
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
                      <dd>{sessionProjectPath || activeProject.path || '—'}</dd>
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

      {githubOpen && (
        <GithubConnectModal
          status={githubStatus}
          onProjectCreated={p => void handleSelectProject(p)}
          onClose={() => setGithubOpen(false)}
        />
      )}

      {preparing && (
        <div className="palette-overlay">
          <div className="github-preparing" role="status" aria-live="polite">
            <span className="github-preparing-spinner" aria-hidden="true" />
            {prepareStatus}
          </div>
        </div>
      )}
    </div>
  );
}
