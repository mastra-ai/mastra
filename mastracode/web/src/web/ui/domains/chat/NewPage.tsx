import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useLocation } from 'react-router';

import { useOverlays } from '../../lib/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout, FolderIcon } from '../../ui';
import type { Project } from '../workspaces';
import { EmptyProjectState, useActiveProjectContext } from '../workspaces';
import { deriveProjectPath } from '../workspaces/hooks/useWorkspaces';
import { ChatHeader } from './components/ChatHeader';
import { ChatOverlays } from './components/ChatOverlays';
import { ComposerPanel } from './components/ComposerPanel';
import { TranscriptEntries } from './components/Transcript';
import { ChatSessionBoundary } from './context/ChatSessionProvider';
import { useChatTranscript } from './context/useChatTranscript';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

const draftStartClass = 'flex w-full max-w-xl flex-col items-stretch gap-6';

export function NewPage() {
  const overlays = useOverlays();
  const { activeProject } = useActiveProjectContext();

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      sidebarOpen={overlays.isOpen('sidebar')}
      onSidebarClose={() => overlays.close('sidebar')}
      main={
        <ChatSessionBoundary>
          {activeProject ? (
            <NewPageContent activeProject={activeProject} />
          ) : (
            <EmptyProjectState onOpenProjects={() => overlays.open('projects')} />
          )}
          <ChatOverlays />
        </ChatSessionBoundary>
      }
    />
  );
}

function NewPageContent({ activeProject }: { activeProject: Project }) {
  useGlobalShortcuts();
  const { transcript } = useChatTranscript();
  const location = useLocation();
  const locationState = location.state as { routeErrorNotice?: string } | null;
  const routeErrorNotice = locationState?.routeErrorNotice ?? null;
  const noticeEntries = transcript.entries.filter(entry => entry.kind === 'notice');
  const hasNotices = Boolean(routeErrorNotice) || noticeEntries.length > 0;

  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-4 py-10 md:px-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        <DraftStart activeProject={activeProject} />
        {hasNotices && (
          <div className="flex w-full flex-col gap-4">
            {routeErrorNotice && <Notice variant="destructive">{routeErrorNotice}</Notice>}
            <TranscriptEntries entries={noticeEntries} onApprove={() => undefined} onRespond={() => undefined} />
          </div>
        )}
      </div>
    </div>
  );
}

function DraftStart({ activeProject }: { activeProject: Project }) {
  return (
    <section className={draftStartClass} aria-labelledby="draft-start-heading">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLockup />
        <h1 id="draft-start-heading" className="m-0 text-2xl text-icon6">
          What do you want to work on?
        </h1>
        <ProjectContext activeProject={activeProject} />
      </div>

      {activeProject && <ComposerPanel composerVariant="textarea" />}
    </section>
  );
}

function BrandLockup() {
  return (
    <div className="inline-flex items-center gap-2 text-icon3">
      <LogoWithoutText aria-hidden className="h-4 w-auto" />
      <span className="text-ui-sm font-medium uppercase tracking-widest">Mastra Code</span>
    </div>
  );
}

function ProjectContext({ activeProject }: { activeProject: Project }) {
  // GitHub projects have no local `path`; show the sandbox worktree path instead.
  const projectPath = deriveProjectPath(activeProject);
  return (
    <p className="m-0 flex max-w-full items-center justify-center gap-1.5 text-ui-sm text-icon3">
      <FolderIcon size={13} className="shrink-0 text-icon2" />
      <span className="shrink-0 font-medium">{activeProject.name}</span>
      {activeProject.gitBranch && (
        <>
          <span className="shrink-0 text-icon2">·</span>
          <span className="shrink-0">{activeProject.gitBranch}</span>
        </>
      )}
      {projectPath && (
        <>
          <span className="shrink-0 text-icon2">·</span>
          <span className="min-w-0 truncate text-icon2" title={projectPath}>
            {projectPath}
          </span>
        </>
      )}
    </p>
  );
}
