import { Button } from '@mastra/playground-ui/components/Button';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { MessageSquarePlus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import { useOverlays } from '../../lib/overlays/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui/ChatLayout';
import { FolderIcon } from '../../ui/icons';
import { EmptyProjectState } from '../workspaces/components/EmptyProjectState';
import { useActiveProjectContext } from '../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath } from '../workspaces/hooks/useWorkspaces';
import type { Project } from '../workspaces/services/projects';
import { ChatHeader } from './components/ChatHeader';
import { ConnectionNotice } from './components/ChatMessageList/ConnectionNotice';
import { ComposerPanel } from './components/ComposerPanel';
import { TranscriptEntries } from './components/Transcript';
import { useChatTranscript } from './context/useChatTranscript';

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
      content={
        activeProject ? (
          <NewPageContent activeProject={activeProject} />
        ) : (
          <EmptyProjectState onOpenProjects={() => overlays.open('projects')} />
        )
      }
      footer={null}
    />
  );
}

function NewPageContent({ activeProject }: { activeProject: Project }) {
  const { transcript } = useChatTranscript();
  const location = useLocation();
  const navigate = useNavigate();
  const routeErrorNotice =
    location.state &&
    typeof location.state === 'object' &&
    'routeErrorNotice' in location.state &&
    typeof location.state.routeErrorNotice === 'string'
      ? location.state.routeErrorNotice
      : undefined;
  const noticeEntries = transcript.entries.filter(entry => entry.kind === 'notice');
  const hasNotices = Boolean(routeErrorNotice) || noticeEntries.length > 0;

  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-4 py-10 md:px-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        <ConnectionNotice />
        <DraftStart activeProject={activeProject} />
        {hasNotices && (
          <div className="flex w-full flex-col gap-4">
            {routeErrorNotice && (
              <Notice variant="destructive" title="Thread unavailable">
                <Notice.Message>{routeErrorNotice}</Notice.Message>
                <Notice.Message className="mt-2">Continue in a new thread to send a new request.</Notice.Message>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="mt-3 self-start"
                  onClick={() => void navigate('/new', { replace: true })}
                >
                  <MessageSquarePlus size={15} />
                  <span>Continue in new thread</span>
                </Button>
              </Notice>
            )}
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
