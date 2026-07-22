import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { GitBranch } from 'lucide-react';
import { useLocation } from 'react-router';

import { useOverlays } from '../../lib/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui/ChatLayout';
import { FolderIcon } from '../../ui/icons';
import { EmptyFactoryState } from '../workspaces/components/EmptyFactoryState';
import { useActiveFactoryContext } from '../workspaces/context/ActiveFactoryProvider';
import { isLocalFactory, selectedRepository } from '../workspaces/services/factories';
import type { Factory } from '../workspaces/services/factories';
import { deriveProjectPath } from '../../../../shared/hooks/useWorkspaces';
import { ChatHeader } from './components/ChatHeader';
import { ComposerPanel } from './components/ComposerPanel';
import { TranscriptEntries } from './components/Transcript';
import { ChatSessionBoundary } from './context/ChatSessionProvider';
import { useChatTranscript } from './context/useChatTranscript';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

const draftStartClass = 'flex w-full max-w-xl flex-col items-stretch gap-6';

export function NewPage() {
  const overlays = useOverlays();
  const { activeFactory } = useActiveFactoryContext();

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      main={
        <NewPageBody activeFactory={activeFactory ?? undefined} onOpenFactories={() => overlays.open('factories')} />
      }
    />
  );
}

function NewPageBody({
  activeFactory,
  onOpenFactories,
}: {
  activeFactory: Factory | undefined;
  onOpenFactories: () => void;
}) {
  if (!activeFactory) return <EmptyFactoryState onOpenFactories={onOpenFactories} />;

  return (
    <ChatSessionBoundary>
      <NewPageContent activeFactory={activeFactory} />
    </ChatSessionBoundary>
  );
}

function NewPageContent({ activeFactory }: { activeFactory: Factory }) {
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
        <DraftStart activeFactory={activeFactory} />
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

function DraftStart({ activeFactory }: { activeFactory: Factory }) {
  return (
    <section className={draftStartClass} aria-labelledby="draft-start-heading">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandLockup />
        <h1 id="draft-start-heading" className="m-0 text-2xl text-icon6">
          What do you want to work on?
        </h1>
        <FactoryContext activeFactory={activeFactory} />
      </div>

      {activeFactory && <ComposerPanel composerVariant="textarea" />}
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

function FactoryContext({ activeFactory }: { activeFactory: Factory }) {
  // Server factories have no local `path`; show the sandbox worktree path instead.
  const projectPath = deriveProjectPath(activeFactory);
  const gitBranch = isLocalFactory(activeFactory)
    ? activeFactory.binding.gitBranch
    : selectedRepository(activeFactory)?.gitBranch;
  return (
    <div className="flex max-w-full flex-col items-center gap-1 text-ui-sm text-icon3">
      <div className="flex max-w-full items-center justify-center gap-1.5">
        <FolderIcon size={13} className="shrink-0 text-icon2" />
        <span className="shrink-0 font-medium">{activeFactory.name}</span>
        {projectPath && (
          <>
            <span className="shrink-0 text-icon2">·</span>
            <span className="min-w-0 truncate text-icon2" title={projectPath}>
              {projectPath}
            </span>
          </>
        )}
      </div>
      {gitBranch && (
        <div className="flex max-w-full items-center justify-center gap-1.5">
          <GitBranch size={13} aria-hidden className="shrink-0 text-icon2" />
          <span className="min-w-0 truncate" title={gitBranch}>
            {gitBranch}
          </span>
        </div>
      )}
    </div>
  );
}
