import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useLocation } from 'react-router';

import { FolderIcon } from '../../ui';
import type { Factory } from '../workspaces';
import { isLocalFactory, selectedRepository, useActiveFactoryContext } from '../workspaces';
import { deriveProjectPath } from '../../../../shared/hooks/useWorkspaces';
import { ComposerPanel } from './components/ComposerPanel';
import { TranscriptEntries } from './components/Transcript';
import { useChatTranscript } from './context/useChatTranscript';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { Spinner } from '@mastra/playground-ui/components/Spinner';

const draftStartClass = 'flex w-full max-w-xl flex-col items-stretch gap-6';

export function NewPage() {
  const { factoriesPending, activeFactory } = useActiveFactoryContext();

  if (factoriesPending) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!activeFactory) return <div>No active factory</div>;

  return <NewPageContent activeFactory={activeFactory} />;
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
    <p className="m-0 flex max-w-full items-center justify-center gap-1.5 text-ui-sm text-icon3">
      <FolderIcon size={13} className="shrink-0 text-icon2" />
      <span className="shrink-0 font-medium">{activeFactory.name}</span>
      {gitBranch && (
        <>
          <span className="shrink-0 text-icon2">·</span>
          <span className="shrink-0">{gitBranch}</span>
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
