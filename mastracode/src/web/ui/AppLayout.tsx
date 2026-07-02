import type { PlanResume } from '@mastra/client-js';
import { Button, Notice, Spinner, Txt } from '@mastra/playground-ui';
import type { Theme } from '@mastra/playground-ui';
import { ArrowDown, Menu } from 'lucide-react';
import type { RefObject } from 'react';

import { CommandPalette } from './CommandPalette';
import type { SlashCommand } from './commands';
import { GoalPanel, StatusLine, Transcript } from './components';
import { Composer } from './Composer';
import type { Project } from './projects';
import { ProjectsModal } from './ProjectsModal';
import { SettingsPanel } from './SettingsPanel';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { Sidebar } from './Sidebar';
import type { Density } from './theme';
import type { useAgentControllerSession } from './useAgentControllerSession';

type Session = ReturnType<typeof useAgentControllerSession>;
type TranscriptState = Session['transcript'];

type AppLayoutProps = {
  activeProject: Project | null;
  activeProjectId: string | null;
  projects: Project[];
  threads: Session['threads'];
  transcript: TranscriptState;
  status: Session['status'];
  modes: Session['modes'];
  session: Session;
  busy: boolean;
  showWorkingIndicator: boolean;
  threadRef: RefObject<HTMLDivElement | null>;
  showScrollDown: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  closeSidebar: () => void;
  projectsOpen: boolean;
  setProjectsOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  theme: Theme;
  density: Density;
  resourceId: string;
  sessionEnabled: boolean;
  setProjects: (projects: Project[]) => void;
  selectProject: (project: Project | null) => Promise<void>;
  changeDensity: (density: Density) => void;
  setTheme: (theme: Theme) => void;
  toast: (message: string, variant?: 'success' | 'error') => void;
  onApprove: (toolCallId: string, approved: boolean, id: string) => void;
  onRespond: (toolCallId: string, data: string | string[] | PlanResume, id: string) => void;
  composerCommandName: string | null;
  onComposerCommandApplied: () => void;
  runPaletteCommand: (command: SlashCommand) => void;
};

export function AppLayout({
  activeProject,
  activeProjectId,
  projects,
  threads,
  transcript,
  status,
  modes,
  session,
  busy,
  showWorkingIndicator,
  threadRef,
  showScrollDown,
  scrollToBottom,
  sidebarOpen,
  setSidebarOpen,
  closeSidebar,
  projectsOpen,
  setProjectsOpen,
  settingsOpen,
  setSettingsOpen,
  shortcutsOpen,
  setShortcutsOpen,
  paletteOpen,
  setPaletteOpen,
  theme,
  density,
  resourceId,
  sessionEnabled,
  setProjects,
  selectProject,
  changeDensity,
  setTheme,
  toast,
  onApprove,
  onRespond,
  composerCommandName,
  onComposerCommandApplied,
  runPaletteCommand,
}: AppLayoutProps) {
  return (
    <div className="relative z-1 flex h-screen">
      <Sidebar
        open={sidebarOpen}
        projects={projects}
        activeProjectId={activeProjectId}
        onManageProjects={() => {
          setProjectsOpen(true);
          closeSidebar();
        }}
        onOpenSettings={() => {
          setSettingsOpen(true);
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

      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 md:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <div className="relative z-1 flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border1 px-3 py-2 md:hidden">
          <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle sidebar">
            <Menu />
          </Button>
        </header>

        {!activeProject ? (
          <div className="m-auto flex max-w-md flex-col items-center gap-3 px-6 text-center">
            <Txt as="h2" variant="header-md" className="text-icon6">
              Welcome to MastraCode
            </Txt>
            <Txt as="p" variant="ui-md" className="max-w-sm text-icon3">
              Open a project folder to start a coding session. Each project keeps its own threads, memory, and workspace
              — shared with the terminal.
            </Txt>
            <Button variant="primary" className="mt-2" onClick={() => setProjectsOpen(true)}>
              Open a project
            </Button>
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
              <div role="status" aria-live="polite" className="px-3 pt-2">
                <Notice variant={status === 'reconnecting' ? 'warning' : 'destructive'}>
                  {status === 'reconnecting'
                    ? 'Connection lost — reconnecting…'
                    : 'Disconnected. Check the server and reload to reconnect.'}
                </Notice>
              </div>
            )}

            <div
              className="flex flex-1 flex-col gap-4 overflow-y-auto scroll-smooth px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]"
              ref={threadRef}
            >
              {transcript.entries.length === 0 && (
                <div className="m-auto w-full max-w-[80ch] px-7 py-10 text-left font-mono text-sm leading-relaxed text-icon3">
                  <dl className="mb-4 mt-0 grid gap-0.5">
                    <div className="flex gap-2">
                      <dt className="min-w-24 text-icon2">Project</dt>
                      <dd className="m-0 break-words text-icon5">{activeProject.name}</dd>
                    </div>
                    {activeProject.resourceId && (
                      <div className="flex gap-2">
                        <dt className="min-w-24 text-icon2">Resource ID</dt>
                        <dd className="m-0 break-words text-icon5">{activeProject.resourceId}</dd>
                      </div>
                    )}
                    {activeProject.gitBranch && (
                      <div className="flex gap-2">
                        <dt className="min-w-24 text-icon2">Branch</dt>
                        <dd className="m-0 break-words text-icon5">{activeProject.gitBranch}</dd>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <dt className="min-w-24 text-icon2">Workspace</dt>
                      <dd className="m-0 break-words text-icon5">{activeProject.path}</dd>
                    </div>
                  </dl>
                  <p className="mb-6 mt-0 text-icon3">Ready for new conversation</p>
                </div>
              )}
              <Transcript entries={transcript.entries} onApprove={onApprove} onRespond={onRespond} />
              {showWorkingIndicator && (
                <div className="flex items-center gap-2 px-2 py-2" aria-live="polite" aria-label="Agent is working">
                  <Spinner className="text-icon3" />
                  <Txt as="span" variant="ui-sm" className="text-icon3">
                    Thinking…
                  </Txt>
                </div>
              )}
            </div>

            {showScrollDown && (
              <Button
                variant="default"
                size="icon-sm"
                className="absolute bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-md"
                onClick={() => scrollToBottom('smooth')}
                aria-label="Jump to latest message"
              >
                <ArrowDown size={18} />
              </Button>
            )}

            <div className="shrink-0 max-w-[80ch] w-full mx-auto">
              <Composer
                activeProject={activeProject}
                transcript={transcript}
                status={status}
                busy={busy}
                send={session.send}
                steer={session.steer}
                abort={session.abort}
                commandNameToApply={composerCommandName}
                onCommandApplied={onComposerCommandApplied}
                session={session}
              />

              <StatusLine
                status={status}
                modelId={transcript.modelId}
                running={busy}
                followUpCount={transcript.followUpCount}
                omPhase={transcript.omPhase}
                omProgress={transcript.omProgress}
                goal={transcript.goal}
                workspaceReady={transcript.workspaceReady}
                projectName={activeProject?.name}
                tokensPerSec={transcript.tokensPerSec}
                modes={modes}
                activeModeId={transcript.modeId}
                onModeChange={modeId => void session.switchMode(modeId)}
              />
            </div>
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
          onThemeChange={setTheme}
          onDensityChange={changeDensity}
          onModelChange={modelId => {
            void session.switchModel(modelId);
            toast('Model updated', 'success');
          }}
          onBehaviorChange={updates => {
            void session.setState(updates).then(() => toast('Settings updated', 'success'));
          }}
          permissions={session.permissions}
          pendingPermissionCategory={session.pendingPermissionCategory}
          setPermissionForCategory={session.setPermissionForCategory}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}

      {projectsOpen && (
        <ProjectsModal
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={p => void selectProject(p)}
          onProjectsChange={setProjects}
          onClose={() => setProjectsOpen(false)}
        />
      )}
    </div>
  );
}
