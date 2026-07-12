import { useOverlays } from '../../lib/overlays/overlays';
import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui/ChatLayout';
import { EmptyProjectState } from '../workspaces/components/EmptyProjectState';
import { useActiveProjectContext } from '../workspaces/context/ActiveProjectProvider';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessageList } from './components/ChatMessageList/ChatMessageList';
import { ComposerPanel } from './components/ComposerPanel';
import { useRouteThreadSync } from './hooks/useRouteThreadSync';

const threadComposerContainerClass = 'w-full px-3 md:px-5';
const threadComposerInnerClass = 'mx-auto w-full max-w-[80ch]';

export function ThreadPage() {
  const overlays = useOverlays();
  const { activeProject } = useActiveProjectContext();

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      sidebarOpen={overlays.isOpen('sidebar')}
      onSidebarClose={() => overlays.close('sidebar')}
      content={
        activeProject ? <ThreadPageContent /> : <EmptyProjectState onOpenProjects={() => overlays.open('projects')} />
      }
      footer={activeProject ? <ThreadComposer /> : null}
    />
  );
}

function ThreadComposer() {
  return (
    <div className={threadComposerContainerClass}>
      <div className={threadComposerInnerClass} role="region" aria-label="Thread composer">
        <ComposerPanel />
      </div>
    </div>
  );
}

function ThreadPageContent() {
  useRouteThreadSync();

  return <ChatMessageList />;
}
