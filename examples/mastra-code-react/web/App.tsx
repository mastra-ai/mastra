import { useEffect, useRef, useState } from 'react';

import { GoalPanel, StatusLine, Transcript } from './components';
import { loadProjects, DEFAULT_RESOURCE_ID, projectResourceId } from './projects';
import type { Project } from './projects';
import { Sidebar } from './Sidebar';
import { useHarnessSession } from './useHarnessSession';

export default function App() {
  // ── Projects (localStorage) ─────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  // resourceId is scoped to the active project so threads belong to it.
  const resourceId = activeProject ? projectResourceId(activeProject) : DEFAULT_RESOURCE_ID;

  const session = useHarnessSession({ harnessId: 'code', resourceId });
  const { transcript, status, modes, threads, send, steer, abort } = session;
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the transcript.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [transcript.entries.length, transcript.running]);

  // When a project is selected, set projectPath on the server session state.
  const handleSelectProject = async (project: Project | null) => {
    setActiveProjectId(project?.id ?? null);
    // The hook will re-mount with a new resourceId, creating/resuming the
    // project's session. We also push projectPath so the workspace factory
    // picks it up on the next message.
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
        case 'help':
          session.pushNotice([
            'Available commands:',
            '  /mode <id>        — Switch mode',
            '  /model <id>       — Switch model',
            '  /new [title]       — Create new thread',
            '  /rename <title>    — Rename current thread',
            '  /delete <id>       — Delete a thread',
            '  /clone             — Clone current thread',
            '  /goal <objective>  — Set a goal',
            '  /permissions       — Show permission rules',
            '  /yolo              — Auto-allow all tools',
            '  /cost              — Show token usage',
            '  /settings          — Show session state',
            '  /help              — Show this list',
          ].join('\n'));
          return;
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
            {modes.map(m => (
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
              {activeProject
                ? `Working in ${activeProject.name}. Ask the agent to read, write, or run code.`
                : 'Select a project from the sidebar, or ask the agent to work in the default workspace.'}
            </div>
          )}
          <Transcript
            entries={transcript.entries}
            onApprove={(toolCallId, approved, id) => void session.approveTool(toolCallId, approved, id)}
            onRespond={(toolCallId, data, id) => void session.respondSuspension(toolCallId, data, id)}
          />
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <input
            className="input composer-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
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
      </div>
    </div>
  );
}
