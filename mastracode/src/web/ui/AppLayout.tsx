import type { PlanResume } from '@mastra/client-js';
import { Button, Notice, Spinner, Txt } from '@mastra/playground-ui';
import type { Theme } from '@mastra/playground-ui';
import { ArrowDown, Menu } from 'lucide-react';
import type { RefObject } from 'react';

import type { WebAuthState } from './auth';
import { ChatLayout } from './ChatLayout';
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

const transcriptScrollClass =
  'flex flex-1 flex-col gap-4 overflow-y-auto scroll-smooth px-3 pb-2 pt-6 md:px-5 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[80ch]';
const emptyThreadClass = 'm-auto w-full max-w-[80ch] px-7 py-10 text-left font-mono text-sm leading-relaxed text-icon3';
const composerPanelClass = 'mx-auto w-full max-w-[80ch] shrink-0';

export type WebAuthViewModel = {
  state?: WebAuthState;
  loading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
};

type AppLayoutProps = {
  activeProject: Project | null;
  activeProjectId: string | null;
  projects: Project[];
  auth: WebAuthViewModel;
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

export function AppLayout(props: AppLayoutProps) {
  return (
    <ChatLayout
      sidebar={<SidebarSlot {...props} />}
      content={
        <AppContent
          activeProject={props.activeProject}
          transcript={props.transcript}
          status={props.status}
          modes={props.modes}
          session={props.session}
          busy={props.busy}
          showWorkingIndicator={props.showWorkingIndicator}
          threadRef={props.threadRef}
          showScrollDown={props.showScrollDown}
          scrollToBottom={props.scrollToBottom}
          sidebarOpen={props.sidebarOpen}
          setSidebarOpen={props.setSidebarOpen}
          closeSidebar={props.closeSidebar}
          projectsOpen={props.projectsOpen}
          setProjectsOpen={props.setProjectsOpen}
          settingsOpen={props.settingsOpen}
          setSettingsOpen={props.setSettingsOpen}
          shortcutsOpen={props.shortcutsOpen}
          setShortcutsOpen={props.setShortcutsOpen}
          paletteOpen={props.paletteOpen}
          setPaletteOpen={props.setPaletteOpen}
          theme={props.theme}
          density={props.density}
          resourceId={props.resourceId}
          sessionEnabled={props.sessionEnabled}
          projects={props.projects}
          activeProjectId={props.activeProjectId}
          setProjects={props.setProjects}
          selectProject={props.selectProject}
          changeDensity={props.changeDensity}
          setTheme={props.setTheme}
          toast={props.toast}
          onApprove={props.onApprove}
          onRespond={props.onRespond}
          composerCommandName={props.composerCommandName}
          onComposerCommandApplied={props.onComposerCommandApplied}
          runPaletteCommand={props.runPaletteCommand}
        />
      }
    />
  );
}

type SidebarSlotProps = Pick<
  AppLayoutProps,
  | 'activeProjectId'
  | 'auth'
  | 'busy'
  | 'closeSidebar'
  | 'projects'
  | 'setProjectsOpen'
  | 'setSettingsOpen'
  | 'session'
  | 'sidebarOpen'
  | 'status'
  | 'threads'
  | 'toast'
  | 'transcript'
>;

function SidebarSlot({
  activeProjectId,
  auth,
  busy,
  closeSidebar,
  projects,
  setProjectsOpen,
  setSettingsOpen,
  session,
  sidebarOpen,
  status,
  threads,
  toast,
  transcript,
}: SidebarSlotProps) {
  return (
    <Sidebar
      open={sidebarOpen}
      projects={projects}
      activeProjectId={activeProjectId}
      auth={auth}
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
      status={status}
      running={busy}
    />
  );
}

type AppContentProps = Omit<AppLayoutProps, 'auth' | 'threads'>;

function AppContent({
  activeProject,
  sidebarOpen,
  closeSidebar,
  setSidebarOpen,
  setProjectsOpen,
  ...props
}: AppContentProps) {
  return (
    <>
      <MobileSidebarBackdrop open={sidebarOpen} onClose={closeSidebar} />

      <div className="relative z-1 flex min-w-0 flex-1 flex-col h-full">
        <MobileHeader onToggleSidebar={() => setSidebarOpen(open => !open)} />
        {activeProject ? (
          <ActiveProjectContent activeProject={activeProject} {...props} />
        ) : (
          <EmptyProjectState onOpenProjects={() => setProjectsOpen(true)} />
        )}
      </div>

      <AppOverlays activeProject={activeProject} setProjectsOpen={setProjectsOpen} {...props} />
    </>
  );
}

function MobileSidebarBackdrop({ open, onClose }: { open: boolean; onClose: () => void }) {
  const visibilityClass = open ? 'opacity-100' : 'pointer-events-none opacity-0';

  return (
    <div
      className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 md:hidden ${visibilityClass}`}
      onClick={onClose}
      aria-hidden="true"
    />
  );
}

function MobileHeader({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <header className="flex items-center gap-2 border-b border-border1 px-3 py-2 md:hidden">
      <Button variant="ghost" size="icon-sm" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <Menu />
      </Button>
    </header>
  );
}

function EmptyProjectState({ onOpenProjects }: { onOpenProjects: () => void }) {
  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-3 px-6 text-center">
      <Txt as="h2" variant="header-md" className="text-icon6">
        Welcome to MastraCode
      </Txt>
      <Txt as="p" variant="ui-md" className="max-w-sm text-icon3">
        Open a project folder to start a coding session. Each project keeps its own threads, memory, and workspace —
        shared with the terminal.
      </Txt>
      <Button variant="primary" className="mt-2" onClick={onOpenProjects}>
        Open a project
      </Button>
    </div>
  );
}

type ActiveProjectContentProps = Pick<
  AppLayoutProps,
  | 'busy'
  | 'composerCommandName'
  | 'modes'
  | 'onApprove'
  | 'onComposerCommandApplied'
  | 'onRespond'
  | 'scrollToBottom'
  | 'session'
  | 'showScrollDown'
  | 'showWorkingIndicator'
  | 'status'
  | 'threadRef'
  | 'transcript'
> & {
  activeProject: Project;
};

function ActiveProjectContent({
  activeProject,
  busy,
  composerCommandName,
  modes,
  onApprove,
  onComposerCommandApplied,
  onRespond,
  scrollToBottom,
  session,
  showScrollDown,
  showWorkingIndicator,
  status,
  threadRef,
  transcript,
}: ActiveProjectContentProps) {
  return (
    <div className="h-full overflow-y-scroll grid grid-rows-[1fr_auto]">
      <div className="h-full overflow-y-scroll">
        {transcript.goal && (
          <GoalPanel
            goal={transcript.goal}
            onSetGoal={goal => void session.setGoal(goal)}
            onPauseGoal={() => void session.pauseGoal()}
            onResumeGoal={() => void session.resumeGoal()}
            onClearGoal={() => void session.clearGoal()}
          />
        )}

        <ConnectionNotice status={status} />

        <TranscriptPanel
          activeProject={activeProject}
          transcript={transcript}
          showWorkingIndicator={showWorkingIndicator}
          threadRef={threadRef}
          onApprove={onApprove}
          onRespond={onRespond}
        />

        {showScrollDown && <ScrollToLatestButton onClick={() => scrollToBottom('smooth')} />}
      </div>

      <ComposerPanel
        activeProject={activeProject}
        busy={busy}
        composerCommandName={composerCommandName}
        modes={modes}
        onComposerCommandApplied={onComposerCommandApplied}
        session={session}
        status={status}
        transcript={transcript}
      />
    </div>
  );
}

function ConnectionNotice({ status }: { status: Session['status'] }) {
  if (status !== 'reconnecting' && status !== 'error') {
    return null;
  }

  return (
    <div role="status" aria-live="polite" className="px-3 pt-2">
      <Notice variant={status === 'reconnecting' ? 'warning' : 'destructive'}>
        {status === 'reconnecting'
          ? 'Connection lost — reconnecting…'
          : 'Disconnected. Check the server and reload to reconnect.'}
      </Notice>
    </div>
  );
}

type TranscriptPanelProps = {
  activeProject: Project;
  transcript: TranscriptState;
  showWorkingIndicator: boolean;
  threadRef: RefObject<HTMLDivElement | null>;
  onApprove: AppLayoutProps['onApprove'];
  onRespond: AppLayoutProps['onRespond'];
};

function TranscriptPanel({
  activeProject,
  transcript,
  showWorkingIndicator,
  threadRef,
  onApprove,
  onRespond,
}: TranscriptPanelProps) {
  return (
    <div className={transcriptScrollClass} ref={threadRef}>
      {transcript.entries.length === 0 && <EmptyThreadState activeProject={activeProject} />}
      <Transcript entries={transcript.entries} onApprove={onApprove} onRespond={onRespond} />
      {showWorkingIndicator && <WorkingIndicator />}
    </div>
  );
}

function EmptyThreadState({ activeProject }: { activeProject: Project }) {
  return (
    <div className={emptyThreadClass}>
      <dl className="mb-4 mt-0 grid gap-0.5">
        <ProjectMetadata label="Project" value={activeProject.name} />
        {activeProject.resourceId && <ProjectMetadata label="Resource ID" value={activeProject.resourceId} />}
        {activeProject.gitBranch && <ProjectMetadata label="Branch" value={activeProject.gitBranch} />}
        <ProjectMetadata label="Workspace" value={activeProject.path} />
      </dl>
      <p className="mb-6 mt-0 text-icon3">Ready for new conversation</p>
    </div>
  );
}

function ProjectMetadata({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-24 text-icon2">{label}</dt>
      <dd className="m-0 break-words text-icon5">{value}</dd>
    </div>
  );
}

function WorkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-2 py-2" aria-live="polite" aria-label="Agent is working">
      <Spinner className="text-icon3" />
      <Txt as="span" variant="ui-sm" className="text-icon3">
        Thinking…
      </Txt>
    </div>
  );
}

function ScrollToLatestButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="default"
      size="icon-sm"
      className="absolute bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-md"
      onClick={onClick}
      aria-label="Jump to latest message"
    >
      <ArrowDown size={18} />
    </Button>
  );
}

type ComposerPanelProps = {
  activeProject: Project;
  busy: boolean;
  composerCommandName: string | null;
  modes: Session['modes'];
  onComposerCommandApplied: () => void;
  session: Session;
  status: Session['status'];
  transcript: TranscriptState;
};

function ComposerPanel({
  activeProject,
  busy,
  composerCommandName,
  modes,
  onComposerCommandApplied,
  session,
  status,
  transcript,
}: ComposerPanelProps) {
  return (
    <div className={composerPanelClass}>
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
        modelId={transcript.modelId}
        followUpCount={transcript.followUpCount}
        omPhase={transcript.omPhase}
        omProgress={transcript.omProgress}
        goal={transcript.goal}
        tokensPerSec={transcript.tokensPerSec}
        modes={modes}
        activeModeId={transcript.modeId}
        onModeChange={modeId => void session.switchMode(modeId)}
      />
    </div>
  );
}

type AppOverlaysProps = Pick<
  AppLayoutProps,
  | 'activeProjectId'
  | 'changeDensity'
  | 'density'
  | 'paletteOpen'
  | 'projects'
  | 'projectsOpen'
  | 'resourceId'
  | 'runPaletteCommand'
  | 'selectProject'
  | 'session'
  | 'sessionEnabled'
  | 'setPaletteOpen'
  | 'setProjects'
  | 'setProjectsOpen'
  | 'setSettingsOpen'
  | 'setShortcutsOpen'
  | 'setTheme'
  | 'settingsOpen'
  | 'shortcutsOpen'
  | 'theme'
  | 'toast'
  | 'transcript'
> & {
  activeProject: Project | null;
};

function AppOverlays({
  activeProject,
  activeProjectId,
  changeDensity,
  density,
  paletteOpen,
  projects,
  projectsOpen,
  resourceId,
  runPaletteCommand,
  selectProject,
  session,
  sessionEnabled,
  setPaletteOpen,
  setProjects,
  setProjectsOpen,
  setSettingsOpen,
  setShortcutsOpen,
  setTheme,
  settingsOpen,
  shortcutsOpen,
  theme,
  toast,
  transcript,
}: AppOverlaysProps) {
  return (
    <>
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
          onSelectProject={project => void selectProject(project)}
          onProjectsChange={setProjects}
          onClose={() => setProjectsOpen(false)}
        />
      )}
    </>
  );
}
