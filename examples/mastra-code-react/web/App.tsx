import { useEffect, useRef, useState } from 'react';

import { GoalPanel, StatusLine, Transcript } from './components';
import { ProjectPicker } from './ProjectPicker';
import { loadProjects } from './projects';
import type { Project } from './projects';
import { ThreadSidebar } from './ThreadSidebar';
import { useHarnessSession } from './useHarnessSession';

// A fixed conversation id for this demo. In a real app this is the signed-in
// user id (or a per-conversation id); the server get-or-creates a durable
// session for it, so reloads resume the same thread.
const RESOURCE_ID = 'web-demo-user';

export default function App() {
  const session = useHarnessSession({ harnessId: 'code', resourceId: RESOURCE_ID });
  const { transcript, status, modes, threads, send, steer, abort } = session;
  const [draft, setDraft] = useState('');
  const [showThreads, setShowThreads] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // ── Projects ────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const handleProjectSelect = async (project: Project | null) => {
    setActiveProjectId(project?.id ?? null);
    await session.setState({ projectPath: project?.path ?? '' });
    session.pushNotice(
      project ? `Project: ${project.name} (${project.path})` : 'Switched to default workspace',
    );
  };

  // Auto-scroll the transcript as it grows.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [transcript.entries.length, transcript.running]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void handleInput(text);
  };

  async function handleInput(text: string) {
    // Slash commands mirror a subset of MastraCode's command surface.
    if (text.startsWith('/')) {
      const [cmd, ...rest] = text.slice(1).split(/\s+/);
      const arg = rest.join(' ');
      switch (cmd) {
        case 'mode':
          if (arg) await session.switchMode(arg);
          return;
        case 'model':
          if (arg) await session.switchModel(arg);
          return;
        case 'threads':
          await session.refreshThreads();
          setShowThreads(true);
          return;
        case 'new':
          await session.createThread(arg || undefined);
          return;
        case 'rename':
          if (arg && transcript.threadId) await session.renameThread(transcript.threadId, arg);
          return;
        case 'delete':
          if (arg) await session.deleteThread(arg);
          return;
        case 'clone':
          await session.cloneThread();
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
          const cats = Object.entries(rules.categories ?? {}).map(([k, v]) => `  ${k}: ${v}`).join('\n') || '  (none)';
          const tools = Object.entries(rules.tools ?? {}).map(([k, v]) => `  ${k}: ${v}`).join('\n') || '  (none)';
          session.pushNotice(`Categories:\n${cats}\nTools:\n${tools}`);
          return;
        }
        case 'yolo': {
          const categories = ['read', 'edit', 'execute', 'mcp', 'other'] as const;
          for (const cat of categories) {
            await session.setPermissionForCategory(cat, 'allow');
          }
          session.pushNotice('YOLO mode: all tool categories set to auto-allow');
          return;
        }
        case 'cost': {
          const u = transcript.usage;
          if (!u?.totalTokens) {
            session.pushNotice('No token usage recorded yet.');
          } else {
            session.pushNotice(
              `Tokens — prompt: ${u.promptTokens ?? 0}, completion: ${u.completionTokens ?? 0}, total: ${u.totalTokens}`,
            );
          }
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
            `Mode: ${transcript.modeId ?? '—'}`,
            `Model: ${transcript.modelId ?? '—'}`,
            `Thread: ${transcript.threadId ?? '—'}`,
            `Running: ${transcript.running}`,
            `Tasks: ${transcript.tasks.length}`,
            `Follow-ups queued: ${transcript.followUpCount}`,
            `OM phase: ${transcript.omPhase}`,
            `Workspace: ${transcript.workspaceReady ? 'ready' : 'not ready'}`,
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
        case 'help':
          session.pushNotice(
            [
              'Available commands:',
              '  /mode <id>        — Switch mode (e.g. /mode plan)',
              '  /model <id>       — Switch model',
              '  /threads           — Show thread list',
              '  /new [title]       — Create new thread',
              '  /rename <title>    — Rename current thread',
              '  /delete <id>       — Delete a thread',
              '  /clone             — Clone current thread',
              '  /goal <objective>  — Set a goal',
              '  /goal-clear        — Clear active goal',
              '  /goal-pause        — Pause active goal',
              '  /goal-resume       — Resume paused goal',
              '  /permissions       — Show permission rules',
              '  /yolo              — Auto-allow all tools',
              '  /cost              — Show token usage',
              '  /settings          — Show session state',
              '  /om                — Show OM phase',
              '  /think             — Extended thinking hint',
              '  /follow-up <msg>   — Queue a follow-up message',
              '  /abort             — Abort the current run',
              '  /help              — Show this list',
            ].join('\n'),
          );
          return;
        default:
          session.pushNotice(`Unknown command: /${cmd}. Type /help for available commands.`, 'error');
          return;
      }
    }
    // While the agent runs, additional input steers the active turn.
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
    <div className={showThreads ? 'page-with-sidebar' : ''}>
      {showThreads && (
        <ThreadSidebar
          threads={threads}
          activeThreadId={transcript.threadId}
          onSwitch={id => { void session.switchThread(id); }}
          onCreate={title => { void session.createThread(title); }}
          onRename={(id, title) => { void session.renameThread(id, title); }}
          onDelete={id => { void session.deleteThread(id); }}
          onClose={() => setShowThreads(false)}
        />
      )}

      <div className={showThreads ? 'page-main' : 'page'}>
        <header className="header">
          <span className="header-title">MastraCode</span>
          <ProjectPicker
            projects={projects}
            activeProjectId={activeProjectId}
            onSelect={p => void handleProjectSelect(p)}
            onProjectsChange={setProjects}
          />
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
            <button
              className={`mode-btn ${showThreads ? 'active' : ''}`}
              onClick={() => { void session.refreshThreads(); setShowThreads(s => !s); }}
            >
              threads
            </button>
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <GoalPanel
          goal={transcript.goal}
          onSetGoal={session.setGoal}
          onPauseGoal={session.pauseGoal}
          onResumeGoal={session.resumeGoal}
          onClearGoal={session.clearGoal}
        />

        <main ref={threadRef} className="transcript">
          {transcript.entries.length === 0 && (
            <p className="empty">Ask the coding agent to read, write, or run something in the workspace.</p>
          )}
          <Transcript entries={transcript.entries} onApprove={session.approveTool} onRespond={session.respondSuspension} />
        </main>

        <form onSubmit={onSubmit} className="composer">
          <input
            className="input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={transcript.running ? 'Steer the run, or /command…' : 'Message the agent, or /mode plan…'}
            disabled={status !== 'ready'}
          />
          {transcript.running ? (
            <button type="button" className="btn btn-danger" onClick={() => void abort()}>
              Stop
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={status !== 'ready' || !draft.trim()}>
              Send
            </button>
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
          projectName={projects.find(p => p.id === activeProjectId)?.name}
        />
      </div>
    </div>
  );
}
